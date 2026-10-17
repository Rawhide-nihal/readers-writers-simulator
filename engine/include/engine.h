#ifndef SYNCDB_ENGINE_H
#define SYNCDB_ENGINE_H

#include <stdbool.h>
#include <pthread.h>
#include <cjson/cJSON.h>
#include "protocol.h"
#include "metrics.h"
#include "scheduler.h"
#include "worker.h"

#define MAX_CONCURRENT_WORKERS 100

typedef enum {
    SIM_STATE_IDLE = 0,
    SIM_STATE_RUNNING = 1,
    SIM_STATE_PAUSED = 2,
    SIM_STATE_STOPPED = 3
} sim_state_t;

typedef struct engine {
    char db_path[512];
    char schema_path[512];
    char seed_path[512];

    protocol_channel_t protocol;
    engine_metrics_t metrics;
    scheduler_t scheduler;

    pthread_mutex_t state_lock;
    sim_state_t sim_state;
    char current_exp_id[64];
    bool pause_dispatch;
    bool is_shutting_down;

    // Active workers array
    worker_task_t workers[MAX_CONCURRENT_WORKERS];
    int worker_count;

    pthread_t monitor_thread;
    bool monitor_running;
} engine_t;

int engine_init(engine_t *e, const char *db_path, const char *schema_path, const char *seed_path);
void engine_destroy(engine_t *e);

// Command processing
void engine_process_command(engine_t *e, const char *json_line);
void engine_run_loop(engine_t *e);

// Simulation actions
int engine_start_simulation(engine_t *e, cJSON *params, const char *req_id);
int engine_pause_simulation(engine_t *e, const char *req_id);
int engine_resume_simulation(engine_t *e, const char *req_id);
int engine_stop_simulation(engine_t *e, const char *req_id);
int engine_reset_database(engine_t *e, const char *req_id);

// Snapshot and status JSON generators
cJSON* engine_get_status_json(engine_t *e);
cJSON* engine_get_snapshot_json(engine_t *e);

// Thread-safe event emission helper
void engine_emit_worker_event(engine_t *e,
                              worker_task_t *task,
                              const char *event_type,
                              const char *state_str,
                              cJSON *extra_info);

#endif // SYNCDB_ENGINE_H
