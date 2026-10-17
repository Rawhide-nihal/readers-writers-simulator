#include "scheduler.h"
#include <stdio.h>
#include <string.h>

void scheduler_init(scheduler_t *s, sync_policy_t policy, engine_metrics_t *m) {
    if (!s) return;
    memset(s, 0, sizeof(scheduler_t));
    s->policy = policy;
    s->metrics = m;
    s->is_stopped = false;

    pthread_mutex_init(&s->stop_lock, NULL);
    pthread_cond_init(&s->stop_cond, NULL);

    reader_pref_init(&s->reader_pref);
    writer_pref_init(&s->writer_pref);
    fair_scheduler_init(&s->fair);
}

void scheduler_destroy(scheduler_t *s) {
    if (!s) return;
    reader_pref_destroy(&s->reader_pref);
    writer_pref_destroy(&s->writer_pref);
    fair_scheduler_destroy(&s->fair);

    pthread_mutex_destroy(&s->stop_lock);
    pthread_cond_destroy(&s->stop_cond);
}

int scheduler_set_policy(scheduler_t *s, sync_policy_t policy) {
    if (!s) return -1;
    // Policy change must be rejected while simulation is active
    if (s->metrics && (s->metrics->active_readers > 0 || s->metrics->active_writers > 0 ||
                       s->metrics->waiting_readers > 0 || s->metrics->waiting_writers > 0)) {
        return -2; // Cannot change policy while operations are active
    }
    s->policy = policy;
    return 0;
}

const char* scheduler_policy_name(sync_policy_t policy) {
    switch (policy) {
        case POLICY_READER_PREF: return "READER_PREFERENCE";
        case POLICY_WRITER_PREF: return "WRITER_PREFERENCE";
        case POLICY_FAIR:        return "FAIR";
        default:                 return "UNKNOWN";
    }
}

void scheduler_stop(scheduler_t *s) {
    if (!s) return;
    pthread_mutex_lock(&s->stop_lock);
    s->is_stopped = true;

    // Wake any sleeping threads in condition variables
    pthread_cond_broadcast(&s->stop_cond);

    // Broadcast in writer preference
    pthread_mutex_lock(&s->writer_pref.lock);
    pthread_cond_broadcast(&s->writer_pref.can_read);
    pthread_cond_broadcast(&s->writer_pref.can_write);
    pthread_mutex_unlock(&s->writer_pref.lock);

    // Broadcast in fair scheduler
    pthread_mutex_lock(&s->fair.lock);
    fair_waiter_t *curr = s->fair.head;
    while (curr) {
        pthread_cond_broadcast(&curr->cond);
        curr = curr->next;
    }
    pthread_mutex_unlock(&s->fair.lock);

    pthread_mutex_unlock(&s->stop_lock);
}

bool scheduler_is_stopped(scheduler_t *s) {
    if (!s) return false;
    pthread_mutex_lock(&s->stop_lock);
    bool stopped = s->is_stopped;
    pthread_mutex_unlock(&s->stop_lock);
    return stopped;
}

bool scheduler_verify_invariants(scheduler_t *s, const char *context) {
    if (!s || !s->metrics) return true;

    pthread_mutex_lock(&s->metrics->lock);
    int r = s->metrics->active_readers;
    int w = s->metrics->active_writers;
    pthread_mutex_unlock(&s->metrics->lock);

    bool ok = true;
    if (w > 1) ok = false;
    if (w > 0 && r > 0) ok = false;
    if (w < 0 || r < 0) ok = false;

    if (!ok) {
        metrics_record_violation(s->metrics);
        fprintf(stderr, "[SYNC VIOLATION] context=%s active_readers=%d active_writers=%d\n",
                context ? context : "unknown", r, w);
    }
    return ok;
}

int scheduler_reader_lock(scheduler_t *s, const char *op_id, double *wait_time_ms) {
    (void)op_id;
    if (!s) return -1;

    double t_start = get_monotonic_ms();
    metrics_record_arrival(s->metrics, 0);

    int rc = 0;
    if (s->policy == POLICY_READER_PREF) {
        rc = reader_pref_reader_lock(&s->reader_pref);
    } else if (s->policy == POLICY_WRITER_PREF) {
        rc = writer_pref_reader_lock(&s->writer_pref, &s->is_stopped);
    } else if (s->policy == POLICY_FAIR) {
        rc = fair_reader_lock(&s->fair, &s->is_stopped);
    }

    double wait_ms = get_monotonic_ms() - t_start;
    if (wait_time_ms) *wait_time_ms = wait_ms;

    if (rc == 0) {
        metrics_record_admit(s->metrics, 0, wait_ms);
        scheduler_verify_invariants(s, "reader_lock_acquired");
    } else {
        metrics_record_cancel(s->metrics, 0);
    }

    return rc;
}

int scheduler_reader_unlock(scheduler_t *s, const char *op_id, double exec_time_ms, int success) {
    (void)op_id;
    if (!s) return -1;

    // Record release in metrics BEFORE unlocking sync gate so waiting writers see 0 active readers
    metrics_record_release(s->metrics, 0, exec_time_ms, success);

    int rc = 0;
    if (s->policy == POLICY_READER_PREF) {
        rc = reader_pref_reader_unlock(&s->reader_pref);
    } else if (s->policy == POLICY_WRITER_PREF) {
        rc = writer_pref_reader_unlock(&s->writer_pref);
    } else if (s->policy == POLICY_FAIR) {
        rc = fair_reader_unlock(&s->fair);
    }

    scheduler_verify_invariants(s, "reader_unlocked");
    return rc;
}

int scheduler_writer_lock(scheduler_t *s, const char *op_id, double *wait_time_ms) {
    (void)op_id;
    if (!s) return -1;

    double t_start = get_monotonic_ms();
    metrics_record_arrival(s->metrics, 1);

    int rc = 0;
    if (s->policy == POLICY_READER_PREF) {
        rc = reader_pref_writer_lock(&s->reader_pref);
    } else if (s->policy == POLICY_WRITER_PREF) {
        rc = writer_pref_writer_lock(&s->writer_pref, &s->is_stopped);
    } else if (s->policy == POLICY_FAIR) {
        rc = fair_writer_lock(&s->fair, &s->is_stopped);
    }

    double wait_ms = get_monotonic_ms() - t_start;
    if (wait_time_ms) *wait_time_ms = wait_ms;

    if (rc == 0) {
        metrics_record_admit(s->metrics, 1, wait_ms);
        scheduler_verify_invariants(s, "writer_lock_acquired");
    } else {
        metrics_record_cancel(s->metrics, 1);
    }

    return rc;
}

int scheduler_writer_unlock(scheduler_t *s, const char *op_id, double exec_time_ms, int success) {
    (void)op_id;
    if (!s) return -1;

    // Record release in metrics BEFORE unlocking sync gate so waiting readers see 0 active writers
    metrics_record_release(s->metrics, 1, exec_time_ms, success);

    int rc = 0;
    if (s->policy == POLICY_READER_PREF) {
        rc = reader_pref_writer_unlock(&s->reader_pref);
    } else if (s->policy == POLICY_WRITER_PREF) {
        rc = writer_pref_writer_unlock(&s->writer_pref);
    } else if (s->policy == POLICY_FAIR) {
        rc = fair_writer_unlock(&s->fair);
    }

    scheduler_verify_invariants(s, "writer_unlocked");
    return rc;
}
