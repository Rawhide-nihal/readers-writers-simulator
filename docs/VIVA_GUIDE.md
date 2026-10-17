# SyncDB Lab — Viva Voce & Technical Oral Examination Guide
**Project Group:** G-15  
**Team Members:**  
- B. Thrinadh (Roll No: 2520030529)  
- Madhan (Roll No: 2520030263)  
- M. Nihal (Roll No: 2520030124)  
**Project:** Readers–Writers Concurrent Database Simulator (SyncDB Lab)  
**Target Environment:** Ubuntu 22.04/24.04 LTS (x86_64), C11 POSIX Threads, SQLite3 WAL, FastAPI, React/TypeScript.

---

## Table of Contents
1. [Core Concurrency & OS Synchronization Theory](#1-core-concurrency--os-synchronization-theory)
2. [Primitives: Mutexes, Semaphores & Condition Variables](#2-primitives-mutexes-semaphores--condition-variables)
3. [The Three Readers–Writers Algorithms in SyncDB Lab](#3-the-three-readers-writers-algorithms-in-syncdb-lab)
4. [Deadlocks, Starvation & Priority Inversion](#4-deadlocks-starvation--priority-inversion)
5. [Database Engine & SQLite WAL Concurrency](#5-database-engine--sqlite-wal-concurrency)
6. [Process Architecture, IPC & Systems Engineering](#6-process-architecture-ipc--systems-engineering)
7. [Comprehensive 30 Viva Questions & Model Answers](#7-comprehensive-30-viva-questions--model-answers)

---

## 1. Core Concurrency & OS Synchronization Theory

### The Fundamental Readers–Writers Problem
In operating systems, the Readers–Writers problem represents a class of synchronization problems where multiple concurrent threads access a single shared data resource.
- **Readers:** Threads that inspect or query data without modifying it. Multiple readers may concurrently access the resource safely.
- **Writers:** Threads that alter, insert, delete, or reorder the resource. A writer requires exclusive access: no other thread (reader or writer) may access the resource concurrently.

### Invariants of the Problem
Every valid solution must strictly uphold these mathematical invariants at all times $t$:
1. **Reader Safety Invariant:** If $R(t) > 0$, then $W(t) = 0$. (When readers are active, zero writers may be active).
2. **Writer Exclusivity Invariant:** If $W(t) > 0$, then $W(t) = 1$ and $R(t) = 0$. (At most one writer is active, and zero readers are active).
3. **Mutual Exclusion:** In terms of boolean states:
   $$\neg (\text{ActiveReaders} > 0 \land \text{ActiveWriters} > 0) \land (\text{ActiveWriters} \le 1)$$

---

## 2. Primitives: Mutexes, Semaphores & Condition Variables

### Mutex vs Binary Semaphore
| Characteristic | POSIX Mutex (`pthread_mutex_t`) | POSIX Semaphore (`sem_t`) |
|---|---|---|
| **Ownership** | Strict ownership: The thread that locks it **must** be the one that unlocks it. | No ownership: Any thread can signal (`sem_post`) to wake up a waiting thread. |
| **Recursive / Error-checking** | Can be configured as `PTHREAD_MUTEX_RECURSIVE` or `ERRORCHECK`. | Signaling primitive; counter-based (0 or positive integer). |
| **Priority Inversion** | Supports priority inheritance protocols (`PTHREAD_PRIO_INHERIT`). | Does not support priority inheritance. |
| **Typical Use** | Protecting critical sections and shared internal scheduler counters. | Signaling events, resource counting, producer-consumer coordination. |

### Condition Variables vs Busy Waiting
- **Busy Waiting (`while (flag);`):** Consumes 100% CPU cycles spinning on the memory bus, creating cache coherency traffic and starving lower-priority threads.
- **Condition Variables (`pthread_cond_t`):** Enables a thread to sleep atomically releasing an associated mutex. The OS kernel deschedules the thread, placing it on a wait queue until signaled by `pthread_cond_signal()` or `pthread_cond_broadcast()`. Zero CPU cycles are burned while waiting.

### Why Must `pthread_cond_wait` Always Be In a `while` Loop?
```c
pthread_mutex_lock(&lock);
while (!condition_is_met) {
    pthread_cond_wait(&cond, &lock);
}
// perform action
pthread_mutex_unlock(&lock);
```
**Two Essential Reasons:**
1. **Spurious Wakeups:** The POSIX standard explicitly permits kernel implementations to wake sleeping threads even when no signal was issued (due to internal signal delivery or kernel thread preemption).
2. **State Stealing (Mesa Semantics):** Between the moment thread A is signaled and the moment thread A actually reacquires the mutex, another thread B may execute and alter the predicate back to false. The `while` loop re-evaluates the predicate after reacquiring the lock.

---

## 3. The Three Readers–Writers Algorithms in SyncDB Lab

### Algorithm 1: Reader Preference (Courtois First Readers-Writers)
- **Concept:** Favors maximum read throughput. Any arriving reader immediately joins active readers as long as at least one reader is inside the critical section.
- **Key Mechanism:** `read_count` counter protected by a mutex (`count_mutex`). The first reader acquires the global resource gate (`db_gate`). Subsequent readers simply increment `read_count`. The last reader decrements `read_count` to 0 and unlocks `db_gate`.
- **Vulnerability:** **Writer Starvation.** Under heavy, continuous read traffic, `read_count` never drops to 0. Arriving writers sleep indefinitely on `db_gate`.

### Algorithm 2: Writer Preference (Courtois Second Readers-Writers)
- **Concept:** Prevents stale data reads by giving pending writers immediate priority.
- **Key Mechanism:** Tracks `waiting_writers`. When `waiting_writers > 0`, newly arriving readers are blocked at an outer barrier (`reader_cond`) and cannot enter. Active readers finish and exit. As soon as active readers hit 0, the waiting writer enters.
- **Vulnerability:** **Reader Starvation.** If write requests arrive continuously, `waiting_writers` remains $> 0$, trapping all incoming readers indefinitely.

### Algorithm 3: Fair FIFO Scheduling (Ticket Queue + Compatible Batching)
- **Concept:** Starvation-resistant ordering based on Lamport's ticket algorithm / FIFO queues.
- **Key Mechanism:** Each request draws an atomic ticket `my_ticket = next_ticket++`. Threads wait on a condition variable until `head_ticket == my_ticket`.
- **Adjacent Reader Batching:** To avoid degrading to strictly serial execution, when a reader reaches the head, it inspects adjacent consecutive readers and admits them together into the database concurrently.
- **Starvation Resistance:** A queued writer can never be bypassed by newer readers because ticket numbers are strictly monotonic: $T_{\text{new\_reader}} > T_{\text{queued\_writer}}$.

---

## 4. Deadlocks, Starvation & Priority Inversion

### The Four Coffman Conditions for Deadlock
1. **Mutual Exclusion:** At least one resource must be held in a non-shareable mode.
2. **Hold and Wait:** A thread must be holding at least one resource and requesting additional resources currently held by others.
3. **No Preemption:** Resources cannot be forcibly confiscated from a thread holding them.
4. **Circular Wait:** A closed chain of threads exists such that each thread holds a resource requested by the next thread.

### How SyncDB Lab Prevents Deadlocks
- **Strict Lock Hierarchy:** In writer preference and fair scheduling, internal scheduler mutexes (`sched->lock`) are always acquired *before* condition variables and *never* held across database queries or artificial workload sleeps.
- **No Nested Gate Inversions:** Threads never hold the resource gate while attempting to acquire a scheduler gate.
- **Lock Ordering Verification:** All worker threads release mutexes in exact reverse order of acquisition.

### Priority Inversion & Solutions
- **Phenomenon:** A low-priority thread holds a lock. A high-priority thread requests the lock and blocks. A medium-priority thread preempts the low-priority thread (because no lock is shared between medium and low). Consequently, the high-priority thread is indirectly delayed by the medium-priority thread!
- **Solutions:**
  1. *Priority Inheritance:* The low-priority thread holding the lock temporarily inherits the priority of the highest-priority blocked thread until it releases the lock (`PTHREAD_PRIO_INHERIT`).
  2. *Priority Ceiling:* Every lock is assigned a priority ceiling equal to the highest priority of any thread that can acquire it.

---

## 5. Database Engine & SQLite WAL Concurrency

### SQLite WAL Mode (Write-Ahead Logging)
In standard Rollback Journal mode, writing locks the entire database file exclusively. In WAL mode:
- SQLite writes updates to a separate `-wal` file while leaving the original `.sqlite3` file intact.
- Readers read committed snapshots from the database and wal index (`-shm`).
- **Disk-Level Concurrency:** SQLite WAL physically allows 1 writer and $N$ readers concurrently on disk.

### Academic Distinction: Why Does SyncDB Lab Enforce Logical Locking?
**Critical Examiner Question:** *"If SQLite WAL already allows concurrent readers and a writer, why do you need the C POSIX scheduler?"*
**Answer:**
1. **Academic Demonstration of OS Primitives:** SQLite WAL is an implementation detail of a specific storage engine. The assignment mandates demonstrating the classical Operating Systems Readers–Writers synchronization problem at the application/kernel synchronization boundary using `pthread_mutex_t` and `pthread_cond_t`.
2. **Preventing Dirty / Non-Repeatable Bank Transfers:** In our banking simulation, atomic transfers execute a pair of UPDATE statements (`deduct` from A, `add` to B). Without our scheduler gate, a reader reading account balances halfway through an uncommitted transfer would observe an inconsistent bank state where money disappeared! The POSIX scheduler guarantees strict serializability and cross-account balance conservation.

### Preventing Float Precision Errors
- All monetary balances are stored as **64-bit integer paise** (1 INR = 100 paise).
- Example: ₹50,000.75 is stored as `5000075`.
- This eliminates binary IEEE 754 floating-point rounding errors common in financial calculations.

---

## 6. Process Architecture, IPC & Systems Engineering

### Why JSON Lines over Standard Input / Output?
1. **Universal Portability:** Works natively on all POSIX-compliant UNIX environments without requiring socket file permissions, named pipe FIFO filesystem nodes, or OS-specific shared memory setup.
2. **Fault Isolation:** The C multithreaded engine runs in a separate process space from Python. If an out-of-memory error or memory fault occurs in the engine, the Python backend intercepts the crash, logs the error, and cleanly restarts without taking down the web server.
3. **Structured Framing:** Newline (`\n`) delimits complete, independent JSON objects. Each command has a unique `request_id`, enabling asynchronous correlation.
4. **Thread-Safe Serialization:** The C engine wraps all standard output transmissions inside a dedicated `send_lock` mutex. Multiple worker threads emitting events simultaneously cannot interleave bytes or corrupt JSON messages.

### High-Resolution Timing with `clock_gettime`
- Standard `time()` has 1-second resolution (far too coarse).
- `gettimeofday()` measures wall-clock time and is subject to NTP clock jumps and time zone shifts.
- **SyncDB Lab uses `CLOCK_MONOTONIC`:** Monotonically increasing clock unaffected by system time updates, providing nanosecond-precision execution and queue wait times:
  $$\Delta t = (t_{\text{end}}.\text{tv\_sec} - t_{\text{start}}.\text{tv\_sec}) \times 1000 + \frac{t_{\text{end}}.\text{tv\_nsec} - t_{\text{start}}.\text{tv\_nsec}}{1{,}000{,}000} \text{ ms}$$

---

## 7. Comprehensive 30 Viva Questions & Model Answers

### Q1: What is the primary difference between a process and a thread?
**Answer:** A process is an independent execution environment with its own private virtual address space, file descriptor table, and security context. A thread is a lightweight unit of CPU execution within a process that shares the parent process's memory space (heap, data, code segments) and file descriptors, but maintains its own program counter, CPU register set, and stack memory.

### Q2: What is a critical section?
**Answer:** A critical section is a piece of code that accesses shared mutable resources (such as global counters, shared database handles, or linked queues) that must not be concurrently accessed by more than one thread of execution at a time to prevent race conditions and data corruption.

### Q3: What is a race condition?
**Answer:** A race condition is an undesirable flaw that occurs when the output or correctness of a program depends on the non-deterministic relative order or timing of thread execution or context switches.

### Q4: Explain the Readers–Writers problem and its classification.
**Answer:** It is a classical synchronization benchmark first formulated by Courtois, Heymans, and Parnas in 1971. It models access to a database or shared file where readers only inspect data and writers modify data. It is categorized into three major variants: Reader Preference (First), Writer Preference (Second), and Fair / Starvation-Resistant (Third).

### Q5: What is starvation in operating systems?
**Answer:** Starvation is a resource management anomaly where a runnable thread is perpetually denied necessary processor time, locks, or access to shared resources because other threads repeatedly receive higher priority.

### Q6: How does Reader Preference lead to writer starvation?
**Answer:** Under Reader Preference, if reader $R_1$ is inside the critical section and writer $W_1$ arrives, $W_1$ must wait. If before $R_1$ leaves, reader $R_2$ arrives, $R_2$ is permitted to enter. If readers continue to arrive in an overlapping stream, `read_count` never drops to 0, and $W_1$ waits forever.

### Q7: How does Writer Preference solve writer starvation?
**Answer:** Writer Preference tracks queued writers with a `waiting_writers` counter. When a writer signals its intent to write, newly arriving readers are blocked from acquiring the database gate, even if existing active readers are still reading. Once the active readers finish, the waiting writer gets the gate immediately.

### Q8: What is the trade-off of Writer Preference?
**Answer:** It introduces reader starvation. In a write-heavy workload where writers arrive continuously, incoming readers are perpetually queued behind pending writers, leading to high reader wait times and starvation.

### Q9: How does Fair Scheduling (Algorithm 3) solve both reader and writer starvation?
**Answer:** It assigns each incoming request a monotonically increasing FIFO ticket number. Requests are serviced strictly in ticket order. A queued writer with ticket $k$ cannot be overtaken by any reader arriving later with ticket $> k$. Starvation of either readers or writers is mathematically impossible under finite task durations.

### Q10: What is Adjacent Reader Batching in our Fair Scheduler?
**Answer:** Pure FIFO queuing would force a reader behind another reader to wait for individual turns, serializing execution. When our fair scheduler admits a reader at ticket $k$, it inspects subsequent queued tickets. If tickets $k+1, k+2, \dots$ are also readers, it batches them and lets them all enter concurrently. As soon as a writer ticket is encountered, the batch terminates.

### Q11: What is a deadlock?
**Answer:** A deadlock is a permanent state where a set of threads are blocked because each thread holds a resource that another thread in the set requires, and none can proceed without releasing its acquired resource.

### Q12: Why does SyncDB Lab not experience deadlocks?
**Answer:** Because our implementation enforces a strict lock ordering protocol:
1. Internal scheduler locks (`sched->lock`) are short-lived spin/mutex gates used only to evaluate predicates and modify counters.
2. The database gate is never acquired while holding an internal scheduler mutex.
3. No thread ever holds more than one resource gate simultaneously.

### Q13: What is the difference between `pthread_cond_signal` and `pthread_cond_broadcast`?
**Answer:**
- `pthread_cond_signal(&cond)` unblocks at least one thread waiting on the condition variable. It is optimal when only one thread can proceed (e.g., waking a single writer).
- `pthread_cond_broadcast(&cond)` unblocks *all* threads currently waiting on the condition variable. It is necessary when multiple threads can proceed simultaneously (e.g., waking all batched readers).

### Q14: What would happen if we used `if (!condition)` instead of `while (!condition)` with condition variables?
**Answer:** The program would suffer from race conditions and synchronization violations due to spurious wakeups and Mesa scheduling semantics. If two readers are woken by a broadcast but a writer sneaks in first, a thread using `if` would blindly proceed assuming the condition was still valid, corrupting the critical section.

### Q15: Why is `CLOCK_MONOTONIC` preferred over `CLOCK_REALTIME` for measuring operation latencies?
**Answer:** `CLOCK_REALTIME` reflects the system wall-clock time, which can change discontiguously if the system administrator or NTP daemon adjusts the system clock or leap seconds. `CLOCK_MONOTONIC` represents steady, elapsed time from an arbitrary fixed point (like system boot) and can never jump backwards or forwards.

### Q16: What is SQLite WAL mode and what files are generated?
**Answer:** WAL stands for Write-Ahead Logging. Instead of overwriting database pages directly or recording rollback journals, changes are appended to a separate log file (`syncdb.sqlite3-wal`). A shared memory file (`syncdb.sqlite3-shm`) acts as an index for readers to look up the latest committed page versions.

### Q17: What is an atomic transfer in our database layer?
**Answer:** A bank transfer moves funds from Account A to Account B. In SQL, this must be wrapped in `BEGIN IMMEDIATE TRANSACTION; ... COMMIT;`. If either account does not exist or has insufficient funds, a `ROLLBACK` is issued. The scheduler ensures no other writer or reader can interleave and observe a partial transfer.

### Q18: What is Cache Coherency and False Sharing?
**Answer:** Cache coherency ensures that changes made to a memory location by one CPU core's cache are immediately propagated to other cores. False sharing occurs when two independent variables accessed by different threads reside on the same 64-byte CPU cache line, causing unnecessary cache invalidations and performance slowdowns. SyncDB Lab minimizes shared writable state to dedicated structures.

### Q19: Why does the C engine communicate via JSON Lines over `stdin`/`stdout`?
**Answer:** JSON Lines provides explicit newline-delimited framing where each line is a self-contained JSON document. It is standard across programming languages, human-readable for debugging, easy to mock and unit test, and avoids external socket or network configuration issues on Ubuntu.

### Q20: How does the C engine guarantee thread safety when writing to `stdout`?
**Answer:** Multiple worker threads emit status and completion events asynchronously. To prevent interleaved characters or scrambled JSON, the C engine wraps all `printf` calls to `stdout` inside a dedicated POSIX mutex `protocol_send_lock`.

### Q21: What is the purpose of the Python FastAPI backend in this project?
**Answer:** FastAPI acts as the process manager and real-time streaming bridge. It spawns and monitors the C binary as a managed child subprocess, handles REST API requests from the browser, translates them to stdin commands for C, reads stdout JSON events asynchronously via `asyncio`, and broadcasts live state updates to connected React clients via WebSockets.

### Q22: Why not run SQLite directly from Python and eliminate C?
**Answer:** Because Python's Global Interpreter Lock (GIL) prevents genuine multicore operating system thread concurrency. Python threads do not map 1:1 to simultaneous CPU execution for CPU/locking primitives. The core academic requirement of this project is to study actual C11 POSIX threads (`pthread`), low-level mutexes, condition variables, and OS scheduling behavior.

### Q23: What are the seven test presets in SyncDB Lab?
**Answer:**
- Preset A: Balanced Read/Write (50% reads, 50% writes).
- Preset B: Heavy Readers (90% reads, 10% writes — demonstrates writer starvation).
- Preset C: Heavy Writers (10% reads, 90% writes — demonstrates reader starvation).
- Preset D: High Contention Stress Test (many threads, short operations).
- Preset E: Starvation Stress Test (sustained readers under Reader vs Fair policy).
- Preset F: Burst Traffic (alternating waves of readers and writers).
- Preset G: Long-Running Operations (simulates slow network queries or batch reports).

### Q24: What is the difference between concurrency and parallelism?
**Answer:**
- **Concurrency** is about *structure*: the composition of independently executing processes or threads dealing with lots of things at once (can run on a single core via time slicing).
- **Parallelism** is about *execution*: simultaneously executing multiple computations at the exact same physical instant on multiple CPU cores.

### Q25: How does the C engine handle graceful shutdown?
**Answer:** When a `shutdown` or `stop_simulation` command is received, the engine sets an atomic cancellation flag `running = false`, broadcasts to all scheduler condition variables to awaken sleeping threads, waits for active workers to complete via `pthread_join()`, flushes SQLite databases, frees memory structures, and exits with code 0.

### Q26: What is a memory barrier or compiler fence?
**Answer:** Modern CPUs and optimizing compilers reorder memory read/write instructions to optimize instruction pipelining. A memory barrier enforces strict ordering constraints, ensuring memory operations before the fence are committed before operations following it. POSIX mutex locks and condition variables implicitly include full memory barriers.

### Q27: How are integer balances converted to display currency?
**Answer:** The database stores ₹1,000.50 as the integer `100050`. The frontend divides by 100 and formats using the Indian Numbering System (`en-IN` locale): ₹1,00,000.00. This guarantees zero floating-point drift while maintaining standard Indian financial notation.

### Q28: How does the application prevent browser tabs from running conflicting simulations?
**Answer:** The FastAPI backend maintains a single authoritative singleton subprocess instance for the C engine. All connected WebSocket browser tabs observe the same broadcast event stream and synchronized state. Independent tabs cannot spawn competing C engines.

### Q29: What happens if a worker thread crashes or the C engine is killed?
**Answer:** FastAPI's `asyncio` subprocess reader detects EOF on the engine's stdout pipe. It immediately transitions the bridge state to `DISCONNECTED`, emits an error event over WebSockets to notify users on the frontend, logs the exit code, and provides a REST endpoint to reboot the engine.

### Q30: What key conclusion do our empirical benchmark results demonstrate?
**Answer:**
1. Under **Reader Preference**, reader latency is minimized (< 2 ms) at the expense of writer starvation (writer latency exceeds 500 ms in heavy read traffic).
2. Under **Writer Preference**, writer latency remains low, but readers queue up significantly under write bursts.
3. Under **Fair FIFO Scheduling**, neither thread type suffers starvation; average wait times are bounded and deterministic, proving it is the superior policy for general-purpose transactional database access.

---

*SyncDB Lab — Academic Capstone Viva Voce Guide | Group G-15 | Department of Computer Science & Engineering*
