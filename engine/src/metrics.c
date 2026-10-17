#define _POSIX_C_SOURCE 199309L
#include "metrics.h"
#include <string.h>
#include <float.h>

double get_monotonic_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ((double)ts.tv_sec * 1000.0) + ((double)ts.tv_nsec / 1000000.0);
}

int64_t get_wall_clock_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return ((int64_t)ts.tv_sec * 1000) + ((int64_t)ts.tv_nsec / 1000000);
}

void metrics_init(engine_metrics_t *m) {
    if (!m) return;
    memset(m, 0, sizeof(engine_metrics_t));
    pthread_mutex_init(&m->lock, NULL);
    m->min_wait_ms = DBL_MAX;
}

void metrics_reset(engine_metrics_t *m) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    m->active_readers = 0;
    m->active_writers = 0;
    m->waiting_readers = 0;
    m->waiting_writers = 0;
    m->completed_readers = 0;
    m->completed_writers = 0;
    m->failed_operations = 0;
    m->cancelled_operations = 0;
    m->total_operations = 0;
    m->max_simultaneous_readers = 0;
    m->sync_violations = 0;
    m->total_reader_wait_ms = 0.0;
    m->total_writer_wait_ms = 0.0;
    m->min_wait_ms = DBL_MAX;
    m->max_wait_ms = 0.0;
    m->total_execution_ms = 0.0;
    m->is_running = 0;
    pthread_mutex_unlock(&m->lock);
}

void metrics_destroy(engine_metrics_t *m) {
    if (!m) return;
    pthread_mutex_destroy(&m->lock);
}

void metrics_record_arrival(engine_metrics_t *m, int is_writer) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    if (is_writer) {
        m->waiting_writers++;
    } else {
        m->waiting_readers++;
    }
    pthread_mutex_unlock(&m->lock);
}

void metrics_record_admit(engine_metrics_t *m, int is_writer, double wait_ms) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    if (is_writer) {
        if (m->waiting_writers > 0) m->waiting_writers--;
        m->active_writers++;
        m->total_writer_wait_ms += wait_ms;
    } else {
        if (m->waiting_readers > 0) m->waiting_readers--;
        m->active_readers++;
        m->total_reader_wait_ms += wait_ms;
        if (m->active_readers > m->max_simultaneous_readers) {
            m->max_simultaneous_readers = m->active_readers;
        }
    }

    if (wait_ms < m->min_wait_ms) {
        m->min_wait_ms = wait_ms;
    }
    if (wait_ms > m->max_wait_ms) {
        m->max_wait_ms = wait_ms;
    }
    pthread_mutex_unlock(&m->lock);
}

void metrics_record_release(engine_metrics_t *m, int is_writer, double exec_ms, int success) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    if (is_writer) {
        if (m->active_writers > 0) m->active_writers--;
        if (success) {
            m->completed_writers++;
        } else {
            m->failed_operations++;
        }
    } else {
        if (m->active_readers > 0) m->active_readers--;
        if (success) {
            m->completed_readers++;
        } else {
            m->failed_operations++;
        }
    }
    m->total_execution_ms += exec_ms;
    pthread_mutex_unlock(&m->lock);
}

void metrics_record_cancel(engine_metrics_t *m, int is_writer) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    if (is_writer) {
        if (m->waiting_writers > 0) m->waiting_writers--;
    } else {
        if (m->waiting_readers > 0) m->waiting_readers--;
    }
    m->cancelled_operations++;
    pthread_mutex_unlock(&m->lock);
}

void metrics_record_violation(engine_metrics_t *m) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    m->sync_violations++;
    pthread_mutex_unlock(&m->lock);
}

void metrics_start_experiment(engine_metrics_t *m, int total_ops) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    m->total_operations = total_ops;
    clock_gettime(CLOCK_MONOTONIC, &m->exp_start_time);
    m->is_running = 1;
    pthread_mutex_unlock(&m->lock);
}

void metrics_end_experiment(engine_metrics_t *m) {
    if (!m) return;
    pthread_mutex_lock(&m->lock);
    clock_gettime(CLOCK_MONOTONIC, &m->exp_end_time);
    m->is_running = 0;
    pthread_mutex_unlock(&m->lock);
}
