# Synchronization Algorithms & Concurrency Specification
## Readers–Writers Problem Implementation in C11 POSIX Threads
### Group G-15 | SyncDB Lab

---

## 1. Problem Statement & Mathematical Model

The classical **Readers–Writers Problem** models access to a shared resource (in our system, an ACID SQLite database storing financial accounts). Two classes of concurrent threads compete for access:
1. **Readers:** Threads that query account records via SQL `SELECT`. Multiple readers may access the database concurrently without corruption.
2. **Writers:** Threads that modify account balances via SQL `UPDATE` and `INSERT`. A writer requires **strict mutual exclusion** (exclusive access) to prevent lost updates, dirty reads, and inconsistent states.

### Core Synchronization Rules
- **Rule A (Concurrent Readers):** If no writer holds or is granted exclusive access, any number of readers may access the resource simultaneously.
- **Rule B (Exclusive Writers):** At most one writer may hold the resource at any moment.
- **Rule C (No Read/Write Overlap):** No reader may access the resource while a writer owns it.
- **Rule D (No Writer/Writer Overlap):** No two writers may access the resource simultaneously.
- **Rule E (Clean Cleanup):** Every lock acquisition must have a deterministic, leak-free release.

### System Invariants
Throughout execution, the scheduler asserts the following invariants:
$$\text{Invariant 1:} \quad \text{active\_writers} \le 1$$
$$\text{Invariant 2:} \quad \text{active\_writers} > 0 \implies \text{active\_readers} = 0$$
$$\text{Invariant 3:} \quad \text{active\_readers} \ge 0 \quad \land \quad \text{active\_writers} \ge 0$$
$$\text{Invariant 4:} \quad \text{waiting\_readers} \ge 0 \quad \land \quad \text{waiting\_writers} \ge 0$$

---

## 2. Algorithm 1: Reader Preference (Courtois 1st Solution)

### Conceptual Mechanics
Reader Preference prioritizes throughput of reader operations. As long as at least one reader holds the resource, newly arriving readers are immediately permitted to join, without waiting for any queued writers.

### Data Structures in `reader_pref_t`
```c
typedef struct {
    pthread_mutex_t readcount_lock; // Protects read_count
    pthread_mutex_t resource_lock;  // Controls shared access to database
    int read_count;                 // Number of readers currently active
} reader_pref_t;
```

### C Implementation (`engine/src/reader_preference.c`)
```c
int reader_pref_reader_lock(reader_pref_t *rp) {
    pthread_mutex_lock(&rp->readcount_lock);
    rp->read_count++;
    if (rp->read_count == 1) {
        // First reader locks the resource on behalf of all readers
        pthread_mutex_lock(&rp->resource_lock);
    }
    pthread_mutex_unlock(&rp->readcount_lock);
    return 0;
}

int reader_pref_reader_unlock(reader_pref_t *rp) {
    pthread_mutex_lock(&rp->readcount_lock);
    rp->read_count--;
    if (rp->read_count == 0) {
        // Last reader releases the resource gate for waiting writers
        pthread_mutex_unlock(&rp->resource_lock);
    }
    pthread_mutex_unlock(&rp->readcount_lock);
    return 0;
}

int reader_pref_writer_lock(reader_pref_t *rp) {
    // Writer requests exclusive lock on resource
    pthread_mutex_lock(&rp->resource_lock);
    return 0;
}

int reader_pref_writer_unlock(reader_pref_t *rp) {
    pthread_mutex_unlock(&rp->resource_lock);
    return 0;
}
```

### Starvation Analysis
- **Observed Behavior:** If new readers arrive before existing active readers finish, `read_count` never drops to 0. Consequently, `resource_lock` is never released, and waiting writers suffer from **writer starvation**.
- **Demonstration Preset:** Preset D (12 Readers, 2 Writers, Staggered Arrival).

---

## 3. Algorithm 2: Writer Preference (Courtois 2nd Solution)

### Conceptual Mechanics
Writer Preference eliminates writer starvation by preventing newly arriving readers from acquiring the lock if any writer is waiting or active. Existing active readers finish, and then the waiting writer is granted exclusive access.

### Data Structures in `writer_pref_t`
```c
typedef struct {
    pthread_mutex_t lock;      // Protects scheduler counters
    pthread_cond_t can_read;   // Signaled when readers may proceed
    pthread_cond_t can_write;  // Signaled when next writer may proceed
    int active_readers;
    int active_writers;
    int waiting_readers;
    int waiting_writers;
} writer_pref_t;
```

### C Implementation (`engine/src/writer_preference.c`)
```c
int writer_pref_reader_lock(writer_pref_t *wp, bool *stopped) {
    pthread_mutex_lock(&wp->lock);
    wp->waiting_readers++;

    // Readers block if ANY writer is active OR waiting!
    while ((wp->active_writers > 0 || wp->waiting_writers > 0) && (!stopped || !(*stopped))) {
        pthread_cond_wait(&wp->can_read, &wp->lock);
    }

    if (stopped && *stopped) {
        wp->waiting_readers--;
        pthread_mutex_unlock(&wp->lock);
        return -2; // Cancelled
    }

    wp->waiting_readers--;
    wp->active_readers++;
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_reader_unlock(writer_pref_t *wp) {
    pthread_mutex_lock(&wp->lock);
    wp->active_readers--;
    // If last active reader finished and writers are waiting, wake one writer
    if (wp->active_readers == 0 && wp->waiting_writers > 0) {
        pthread_cond_signal(&wp->can_write);
    }
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_writer_lock(writer_pref_t *wp, bool *stopped) {
    pthread_mutex_lock(&wp->lock);
    wp->waiting_writers++;

    // Writers wait until NO active readers AND NO active writers
    while ((wp->active_writers > 0 || wp->active_readers > 0) && (!stopped || !(*stopped))) {
        pthread_cond_wait(&wp->can_write, &wp->lock);
    }

    if (stopped && *stopped) {
        wp->waiting_writers--;
        pthread_mutex_unlock(&wp->lock);
        return -2; // Cancelled
    }

    wp->waiting_writers--;
    wp->active_writers++;
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_writer_unlock(writer_pref_t *wp) {
    pthread_mutex_lock(&wp->lock);
    wp->active_writers--;

    // Prioritize waiting writers over waiting readers!
    if (wp->waiting_writers > 0) {
        pthread_cond_signal(&wp->can_write);
    } else {
        // Only wake readers if zero writers are waiting
        pthread_cond_broadcast(&wp->can_read);
    }
    pthread_mutex_unlock(&wp->lock);
    return 0;
}
```

### Starvation Analysis
- **Observed Behavior:** If writers arrive continuously, `waiting_writers > 0` remains true, indefinitely blocking newly arriving readers in `can_read` (**reader starvation**).
- **Demonstration Preset:** Preset E (2 Readers, 6 Writers).

---

## 4. Algorithm 3: Fair Starvation-Resistant FIFO Scheduling

### Conceptual Mechanics
Neither readers nor writers are starved. Requests are enqueued strictly in FIFO arrival order. Adjacent compatible readers at the head of the queue are batched and admitted concurrently. However, newly arriving readers *cannot* bypass a queued writer.

### Data Structures in `fair_scheduler_t`
```c
typedef struct fair_waiter {
    int ticket;
    bool is_writer;
    bool granted;
    pthread_cond_t cond;
    struct fair_waiter *next;
} fair_waiter_t;

typedef struct {
    pthread_mutex_t lock;
    int active_readers;
    int active_writers;
    fair_waiter_t *head;
    fair_waiter_t *tail;
    int next_ticket;
} fair_scheduler_t;
```

### Batching & Dispatch Logic (`engine/src/fair_scheduler.c`)
```c
static void fair_schedule_next(fair_scheduler_t *fs) {
    if (!fs->head || fs->active_writers > 0) return;

    if (fs->head->is_writer) {
        // Head is writer: can admit only if no readers and no writers active
        if (fs->active_readers == 0 && fs->active_writers == 0) {
            fair_waiter_t *w = fs->head;
            fs->head = w->next;
            if (!fs->head) fs->tail = NULL;

            fs->active_writers = 1;
            w->granted = true;
            pthread_cond_signal(&w->cond);
        }
    } else {
        // Head is reader: admit head and ALL consecutive adjacent readers!
        if (fs->active_writers == 0) {
            while (fs->head && !fs->head->is_writer) {
                fair_waiter_t *r = fs->head;
                fs->head = r->next;
                if (!fs->head) fs->tail = NULL;

                fs->active_readers++;
                r->granted = true;
                pthread_cond_signal(&r->cond);
            }
        }
    }
}
```

### Fairness Guarantees
- Every request makes progress within bounded steps proportional to queue depth.
- Compatible readers batch efficiently without compromising fairness.
- Zero starvation for both readers and writers.

---

## 5. Summary Comparison Matrix

| Property | Reader Preference (Alg 1) | Writer Preference (Alg 2) | Fair FIFO (Alg 3) |
|---|---|---|---|
| **Underlying Primitives** | 2 Mutexes (`readcount_lock`, `resource_lock`) | 1 Mutex, 2 Condition Variables (`can_read`, `can_write`) | 1 Mutex, Per-node Condition Variables, FIFO linked queue |
| **Reader Throughput** | Maximum under reader-heavy loads | Lower under writer loads | Balanced |
| **Writer Latency** | High / Potential Starvation | Minimal | Low / Bounded |
| **Starvation Potential** | Writers can starve | Readers can starve | Neither can starve (Bounded FIFO) |
| **Batching** | Continuous opportunistic reader joining | Readers only when no writers queued | Adjacent consecutive readers in arrival order |
| **Invariants Guaranteed** | $\text{W} \le 1, \text{W} > 0 \implies \text{R} = 0$ | $\text{W} \le 1, \text{W} > 0 \implies \text{R} = 0$ | $\text{W} \le 1, \text{W} > 0 \implies \text{R} = 0$ |
