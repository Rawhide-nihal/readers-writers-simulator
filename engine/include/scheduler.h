#ifndef SYNCDB_SCHEDULER_H
#define SYNCDB_SCHEDULER_H

#include <pthread.h>
#include <stdbool.h>
#include "metrics.h"

typedef enum {
    POLICY_READER_PREF = 1,
    POLICY_WRITER_PREF = 2,
    POLICY_FAIR = 3
} sync_policy_t;

// Classical Reader-Preference State (Courtois 1st RW)
typedef struct {
    pthread_mutex_t readcount_lock;
    pthread_mutex_t resource_lock;
    int read_count;
} reader_pref_t;

// Classical Writer-Preference State (Courtois 2nd RW / condition variables)
typedef struct {
    pthread_mutex_t lock;
    pthread_cond_t can_read;
    pthread_cond_t can_write;
    int active_readers;
    int active_writers;
    int waiting_readers;
    int waiting_writers;
} writer_pref_t;

// Fair Starvation-Resistant FIFO Queue Item
typedef struct fair_waiter {
    int ticket;
    bool is_writer;
    bool granted;
    pthread_cond_t cond;
    struct fair_waiter *next;
} fair_waiter_t;

// Fair Scheduling State (FIFO queue with reader-group batching)
typedef struct {
    pthread_mutex_t lock;
    int active_readers;
    int active_writers;
    fair_waiter_t *head;
    fair_waiter_t *tail;
    int next_ticket;
} fair_scheduler_t;

typedef struct scheduler {
    sync_policy_t policy;
    engine_metrics_t *metrics;
    
    // Separate algorithm contexts
    reader_pref_t reader_pref;
    writer_pref_t writer_pref;
    fair_scheduler_t fair;

    // Safety and cancellation flag
    bool is_stopped;
    pthread_mutex_t stop_lock;
    pthread_cond_t stop_cond;
} scheduler_t;

// Sub-scheduler internal function prototypes
void reader_pref_init(reader_pref_t *rp);
void reader_pref_destroy(reader_pref_t *rp);
int reader_pref_reader_lock(reader_pref_t *rp);
int reader_pref_reader_unlock(reader_pref_t *rp);
int reader_pref_writer_lock(reader_pref_t *rp);
int reader_pref_writer_unlock(reader_pref_t *rp);

void writer_pref_init(writer_pref_t *wp);
void writer_pref_destroy(writer_pref_t *wp);
int writer_pref_reader_lock(writer_pref_t *wp, bool *stopped);
int writer_pref_reader_unlock(writer_pref_t *wp);
int writer_pref_writer_lock(writer_pref_t *wp, bool *stopped);
int writer_pref_writer_unlock(writer_pref_t *wp);

void fair_scheduler_init(fair_scheduler_t *fs);
void fair_scheduler_destroy(fair_scheduler_t *fs);
int fair_reader_lock(fair_scheduler_t *fs, bool *stopped);
int fair_reader_unlock(fair_scheduler_t *fs);
int fair_writer_lock(fair_scheduler_t *fs, bool *stopped);
int fair_writer_unlock(fair_scheduler_t *fs);

// Lifecycle
void scheduler_init(scheduler_t *s, sync_policy_t policy, engine_metrics_t *m);
void scheduler_destroy(scheduler_t *s);
int scheduler_set_policy(scheduler_t *s, sync_policy_t policy);
const char* scheduler_policy_name(sync_policy_t policy);

// Cooperative Cancellation / Stop
void scheduler_stop(scheduler_t *s);
bool scheduler_is_stopped(scheduler_t *s);

// Unified Scheduler Lock / Unlock APIs
int scheduler_reader_lock(scheduler_t *s, const char *op_id, double *wait_time_ms);
int scheduler_reader_unlock(scheduler_t *s, const char *op_id, double exec_time_ms, int success);

int scheduler_writer_lock(scheduler_t *s, const char *op_id, double *wait_time_ms);
int scheduler_writer_unlock(scheduler_t *s, const char *op_id, double exec_time_ms, int success);

// Invariant assertion check
bool scheduler_verify_invariants(scheduler_t *s, const char *context);

#endif // SYNCDB_SCHEDULER_H
