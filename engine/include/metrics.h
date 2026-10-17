#ifndef SYNCDB_METRICS_H
#define SYNCDB_METRICS_H

#include <stdint.h>
#include <pthread.h>
#include <time.h>

typedef struct {
    int active_readers;
    int active_writers;
    int waiting_readers;
    int waiting_writers;
    int completed_readers;
    int completed_writers;
    int failed_operations;
    int cancelled_operations;
    int total_operations;
    int max_simultaneous_readers;
    int sync_violations;

    // Timing statistics in milliseconds
    double total_reader_wait_ms;
    double total_writer_wait_ms;
    double min_wait_ms;
    double max_wait_ms;
    double total_execution_ms;
    
    // Experiment timing
    struct timespec exp_start_time;
    struct timespec exp_end_time;
    int is_running;

    pthread_mutex_t lock;
} engine_metrics_t;

void metrics_init(engine_metrics_t *m);
void metrics_reset(engine_metrics_t *m);
void metrics_destroy(engine_metrics_t *m);

void metrics_record_arrival(engine_metrics_t *m, int is_writer);
void metrics_record_admit(engine_metrics_t *m, int is_writer, double wait_ms);
void metrics_record_release(engine_metrics_t *m, int is_writer, double exec_ms, int success);
void metrics_record_cancel(engine_metrics_t *m, int is_writer);
void metrics_record_violation(engine_metrics_t *m);

void metrics_start_experiment(engine_metrics_t *m, int total_ops);
void metrics_end_experiment(engine_metrics_t *m);

// Timing helper
double get_monotonic_ms(void);
int64_t get_wall_clock_ms(void);

#endif // SYNCDB_METRICS_H
