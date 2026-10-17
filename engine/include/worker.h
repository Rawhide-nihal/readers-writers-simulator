#ifndef SYNCDB_WORKER_H
#define SYNCDB_WORKER_H

#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>

typedef enum {
    ROLE_READER = 1,
    ROLE_WRITER = 2
} worker_role_t;

typedef enum {
    OP_TYPE_READ = 1,
    OP_TYPE_DEPOSIT = 2,
    OP_TYPE_WITHDRAW = 3,
    OP_TYPE_TRANSFER = 4
} op_type_t;

struct engine; // Forward declaration

typedef struct worker_task {
    char op_id[64];
    char exp_id[64];
    worker_role_t role;
    op_type_t op_type;
    char account_id[32];
    char target_account_id[32]; // For transfers
    int64_t amount_paise;
    int workload_ms;            // Teaching delay in ms to make concurrency visible
    int arrival_delay_ms;       // Stagger delay before entering scheduling queue

    struct engine *engine;
    pthread_t thread;
    bool is_joined;
    bool is_cancelled;

    double arrival_time_ms;
    double acquired_time_ms;
    double release_time_ms;
} worker_task_t;

void* worker_thread_entry(void *arg);

#endif // SYNCDB_WORKER_H
