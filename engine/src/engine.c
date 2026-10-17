#include "engine.h"
#include "database.h"
#include "protocol.h"
#include "metrics.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

void engine_emit_worker_event(engine_t *e,
                              worker_task_t *task,
                              const char *event_type,
                              const char *state_str,
                              cJSON *extra_info) {
    if (!e || !task) return;

    pthread_mutex_lock(&e->metrics.lock);
    int ar = e->metrics.active_readers;
    int aw = e->metrics.active_writers;
    int wr = e->metrics.waiting_readers;
    int ww = e->metrics.waiting_writers;
    pthread_mutex_unlock(&e->metrics.lock);

    const char *role_str = (task->role == ROLE_READER) ? "READER" : "WRITER";
    const char *pol_str = scheduler_policy_name(e->scheduler.policy);

    protocol_send_event(&e->protocol,
                        task->exp_id,
                        task->op_id,
                        role_str,
                        event_type,
                        state_str,
                        task->account_id,
                        pol_str,
                        ar, aw, wr, ww,
                        get_monotonic_ms(),
                        extra_info);
}

int engine_init(engine_t *e, const char *db_path, const char *schema_path, const char *seed_path) {
    if (!e || !db_path || !schema_path || !seed_path) return -1;
    memset(e, 0, sizeof(engine_t));

    strncpy(e->db_path, db_path, sizeof(e->db_path) - 1);
    strncpy(e->schema_path, schema_path, sizeof(e->schema_path) - 1);
    strncpy(e->seed_path, seed_path, sizeof(e->seed_path) - 1);

    pthread_mutex_init(&e->state_lock, NULL);
    e->sim_state = SIM_STATE_IDLE;
    e->is_shutting_down = false;
    e->worker_count = 0;

    protocol_init(&e->protocol);
    metrics_init(&e->metrics);
    scheduler_init(&e->scheduler, POLICY_READER_PREF, &e->metrics);

    // Initialize database
    if (db_reset_from_scripts(e->db_path, e->schema_path, e->seed_path) != 0) {
        protocol_log_error("Failed to initialize database with schema and seed");
    } else {
        protocol_log_debug("Database initialized successfully at %s", e->db_path);
    }

    return 0;
}

void engine_destroy(engine_t *e) {
    if (!e) return;
    e->is_shutting_down = true;

    // Stop scheduler and wait for workers
    scheduler_stop(&e->scheduler);

    pthread_mutex_lock(&e->state_lock);
    for (int i = 0; i < e->worker_count; i++) {
        if (!e->workers[i].is_joined) {
            pthread_join(e->workers[i].thread, NULL);
            e->workers[i].is_joined = true;
        }
    }
    pthread_mutex_unlock(&e->state_lock);

    scheduler_destroy(&e->scheduler);
    metrics_destroy(&e->metrics);
    protocol_destroy(&e->protocol);
    pthread_mutex_destroy(&e->state_lock);
}

static void wait_existing_workers(engine_t *e) {
    for (int i = 0; i < e->worker_count; i++) {
        if (!e->workers[i].is_joined) {
            pthread_join(e->workers[i].thread, NULL);
            e->workers[i].is_joined = true;
        }
    }
    e->worker_count = 0;
}

// Background thread to monitor experiment completion and notify
static void* experiment_monitor_thread(void *arg) {
    engine_t *e = (engine_t*)arg;
    for (int i = 0; i < e->worker_count; i++) {
        if (!e->workers[i].is_joined) {
            pthread_join(e->workers[i].thread, NULL);
            e->workers[i].is_joined = true;
        }
    }

    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state == SIM_STATE_RUNNING || e->sim_state == SIM_STATE_PAUSED) {
        e->sim_state = SIM_STATE_IDLE;
        metrics_end_experiment(&e->metrics);

        cJSON *summary = cJSON_CreateObject();
        cJSON_AddNumberToObject(summary, "completed_readers", e->metrics.completed_readers);
        cJSON_AddNumberToObject(summary, "completed_writers", e->metrics.completed_writers);
        cJSON_AddNumberToObject(summary, "failed_operations", e->metrics.failed_operations);
        cJSON_AddNumberToObject(summary, "cancelled_operations", e->metrics.cancelled_operations);
        cJSON_AddNumberToObject(summary, "max_simultaneous_readers", e->metrics.max_simultaneous_readers);
        cJSON_AddNumberToObject(summary, "sync_violations", e->metrics.sync_violations);

        protocol_send_event(&e->protocol,
                            e->current_exp_id,
                            "SYSTEM",
                            "SYSTEM",
                            "EXPERIMENT_FINISHED",
                            "COMPLETED",
                            "",
                            scheduler_policy_name(e->scheduler.policy),
                            0, 0, 0, 0,
                            get_monotonic_ms(),
                            summary);
    }
    e->monitor_running = false;
    pthread_mutex_unlock(&e->state_lock);
    return NULL;
}

int engine_start_simulation(engine_t *e, cJSON *params, const char *req_id) {
    if (!e || !params) return -1;

    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state == SIM_STATE_RUNNING || e->sim_state == SIM_STATE_PAUSED) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, false, NULL, "An experiment is already in progress");
        return -2;
    }

    wait_existing_workers(e);

    // Parse parameters
    cJSON *c_readers = cJSON_GetObjectItem(params, "readers_count");
    cJSON *c_writers = cJSON_GetObjectItem(params, "writers_count");
    cJSON *c_policy = cJSON_GetObjectItem(params, "policy");
    cJSON *c_r_workload = cJSON_GetObjectItem(params, "reader_workload_ms");
    cJSON *c_w_workload = cJSON_GetObjectItem(params, "writer_workload_ms");
    cJSON *c_pattern = cJSON_GetObjectItem(params, "arrival_pattern");
    cJSON *c_interval = cJSON_GetObjectItem(params, "arrival_interval_ms");
    cJSON *c_acc_id = cJSON_GetObjectItem(params, "account_id");
    cJSON *c_writer_op = cJSON_GetObjectItem(params, "writer_op_type");
    cJSON *c_seed = cJSON_GetObjectItem(params, "seed");

    int num_readers = (c_readers && c_readers->valueint >= 0) ? c_readers->valueint : 5;
    int num_writers = (c_writers && c_writers->valueint >= 0) ? c_writers->valueint : 2;
    int r_workload = (c_r_workload && c_r_workload->valueint >= 0) ? c_r_workload->valueint : 800;
    int w_workload = (c_w_workload && c_w_workload->valueint >= 0) ? c_w_workload->valueint : 1200;
    int arrival_interval = (c_interval && c_interval->valueint >= 0) ? c_interval->valueint : 150;
    const char *pattern_str = c_pattern && c_pattern->valuestring ? c_pattern->valuestring : "BURST";
    const char *target_acc = c_acc_id && c_acc_id->valuestring ? c_acc_id->valuestring : "ACC001";
    const char *writer_op_str = c_writer_op && c_writer_op->valuestring ? c_writer_op->valuestring : "DEPOSIT";

    // Update policy
    if (c_policy && c_policy->valuestring) {
        if (strcmp(c_policy->valuestring, "WRITER_PREFERENCE") == 0) {
            scheduler_set_policy(&e->scheduler, POLICY_WRITER_PREF);
        } else if (strcmp(c_policy->valuestring, "FAIR") == 0) {
            scheduler_set_policy(&e->scheduler, POLICY_FAIR);
        } else {
            scheduler_set_policy(&e->scheduler, POLICY_READER_PREF);
        }
    }

    int total_ops = num_readers + num_writers;
    if (total_ops <= 0 || total_ops > MAX_CONCURRENT_WORKERS) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, false, NULL, "Total operations must be between 1 and 100");
        return -3;
    }

    if (c_seed) {
        srand((unsigned int)c_seed->valueint);
    }

    snprintf(e->current_exp_id, sizeof(e->current_exp_id), "EXP-%ld-%d", (long)time(NULL), rand() % 10000);
    e->sim_state = SIM_STATE_RUNNING;
    e->scheduler.is_stopped = false;
    e->worker_count = total_ops;

    metrics_reset(&e->metrics);
    metrics_start_experiment(&e->metrics, total_ops);

    // Prepare worker tasks array: interleave or arrange according to arrival pattern
    int r_idx = 0;
    int w_idx = 0;
    int op_counter = 1;

    for (int i = 0; i < total_ops; i++) {
        worker_task_t *task = &e->workers[i];
        memset(task, 0, sizeof(worker_task_t));
        task->engine = e;
        strncpy(task->exp_id, e->current_exp_id, sizeof(task->exp_id) - 1);
        snprintf(task->op_id, sizeof(task->op_id), "OP-%03d", op_counter++);
        task->is_joined = false;
        task->is_cancelled = false;

        // Decide whether this task is reader or writer
        bool choose_writer = false;
        if (w_idx < num_writers && r_idx < num_readers) {
            // Mixed interleaved
            if (strcmp(pattern_str, "RANDOM") == 0) {
                choose_writer = (rand() % 2 == 0);
            } else {
                choose_writer = ((i % 2) != 0);
            }
        } else if (w_idx < num_writers) {
            choose_writer = true;
        } else {
            choose_writer = false;
        }

        if (choose_writer) {
            task->role = ROLE_WRITER;
            w_idx++;
            task->workload_ms = w_workload;

            if (strcmp(writer_op_str, "WITHDRAW") == 0) {
                task->op_type = OP_TYPE_WITHDRAW;
                task->amount_paise = 100000; // ₹1,000
            } else if (strcmp(writer_op_str, "TRANSFER") == 0) {
                task->op_type = OP_TYPE_TRANSFER;
                task->amount_paise = 50000;  // ₹500
                strncpy(task->target_account_id, "ACC002", sizeof(task->target_account_id) - 1);
            } else {
                task->op_type = OP_TYPE_DEPOSIT;
                task->amount_paise = 200000; // ₹2,000
            }
        } else {
            task->role = ROLE_READER;
            r_idx++;
            task->workload_ms = r_workload;
            task->op_type = OP_TYPE_READ;
        }

        strncpy(task->account_id, target_acc, sizeof(task->account_id) - 1);

        // Arrival timing delay
        if (strcmp(pattern_str, "STAGGERED") == 0) {
            task->arrival_delay_ms = i * arrival_interval;
        } else if (strcmp(pattern_str, "RANDOM") == 0) {
            task->arrival_delay_ms = (rand() % (total_ops * (arrival_interval > 0 ? arrival_interval : 100)));
        } else {
            task->arrival_delay_ms = 0; // Simultaneous BURST
        }
    }

    // Emit EXPERIMENT_STARTED event
    cJSON *exp_info = cJSON_CreateObject();
    cJSON_AddStringToObject(exp_info, "experiment_id", e->current_exp_id);
    cJSON_AddNumberToObject(exp_info, "readers_count", num_readers);
    cJSON_AddNumberToObject(exp_info, "writers_count", num_writers);
    cJSON_AddStringToObject(exp_info, "policy", scheduler_policy_name(e->scheduler.policy));
    cJSON_AddStringToObject(exp_info, "arrival_pattern", pattern_str);

    protocol_send_event(&e->protocol,
                        e->current_exp_id,
                        "SYSTEM",
                        "SYSTEM",
                        "EXPERIMENT_STARTED",
                        "RUNNING",
                        target_acc,
                        scheduler_policy_name(e->scheduler.policy),
                        0, 0, 0, 0,
                        get_monotonic_ms(),
                        exp_info);

    // Launch genuine POSIX pthread workers
    for (int i = 0; i < total_ops; i++) {
        pthread_create(&e->workers[i].thread, NULL, worker_thread_entry, &e->workers[i]);
    }

    // Start monitor thread
    e->monitor_running = true;
    pthread_create(&e->monitor_thread, NULL, experiment_monitor_thread, e);
    pthread_detach(e->monitor_thread);

    cJSON *resp_data = cJSON_CreateObject();
    cJSON_AddStringToObject(resp_data, "experiment_id", e->current_exp_id);
    cJSON_AddNumberToObject(resp_data, "total_operations", total_ops);
    cJSON_AddStringToObject(resp_data, "status", "RUNNING");

    protocol_send_response(&e->protocol, req_id, true, resp_data, NULL);
    pthread_mutex_unlock(&e->state_lock);
    return 0;
}

int engine_pause_simulation(engine_t *e, const char *req_id) {
    if (!e) return -1;
    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state != SIM_STATE_RUNNING) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, false, NULL, "Simulation is not actively running");
        return -2;
    }
    e->sim_state = SIM_STATE_PAUSED;
    e->pause_dispatch = true;

    protocol_send_event(&e->protocol,
                        e->current_exp_id,
                        "SYSTEM",
                        "SYSTEM",
                        "SIMULATION_PAUSED",
                        "PAUSED",
                        "",
                        scheduler_policy_name(e->scheduler.policy),
                        e->metrics.active_readers, e->metrics.active_writers,
                        e->metrics.waiting_readers, e->metrics.waiting_writers,
                        get_monotonic_ms(), NULL);

    cJSON *resp = cJSON_CreateObject();
    cJSON_AddStringToObject(resp, "status", "PAUSED");
    protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    pthread_mutex_unlock(&e->state_lock);
    return 0;
}

int engine_resume_simulation(engine_t *e, const char *req_id) {
    if (!e) return -1;
    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state != SIM_STATE_PAUSED) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, false, NULL, "Simulation is not paused");
        return -2;
    }
    e->sim_state = SIM_STATE_RUNNING;
    e->pause_dispatch = false;

    protocol_send_event(&e->protocol,
                        e->current_exp_id,
                        "SYSTEM",
                        "SYSTEM",
                        "SIMULATION_RESUMED",
                        "RUNNING",
                        "",
                        scheduler_policy_name(e->scheduler.policy),
                        e->metrics.active_readers, e->metrics.active_writers,
                        e->metrics.waiting_readers, e->metrics.waiting_writers,
                        get_monotonic_ms(), NULL);

    cJSON *resp = cJSON_CreateObject();
    cJSON_AddStringToObject(resp, "status", "RUNNING");
    protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    pthread_mutex_unlock(&e->state_lock);
    return 0;
}

int engine_stop_simulation(engine_t *e, const char *req_id) {
    if (!e) return -1;
    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state == SIM_STATE_IDLE) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, true, NULL, "Simulation already idle");
        return 0;
    }

    scheduler_stop(&e->scheduler);
    e->sim_state = SIM_STATE_STOPPED;

    protocol_send_event(&e->protocol,
                        e->current_exp_id,
                        "SYSTEM",
                        "SYSTEM",
                        "SIMULATION_STOPPED",
                        "STOPPED",
                        "",
                        scheduler_policy_name(e->scheduler.policy),
                        e->metrics.active_readers, e->metrics.active_writers,
                        e->metrics.waiting_readers, e->metrics.waiting_writers,
                        get_monotonic_ms(), NULL);

    cJSON *resp = cJSON_CreateObject();
    cJSON_AddStringToObject(resp, "status", "STOPPED");
    protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    pthread_mutex_unlock(&e->state_lock);
    return 0;
}

int engine_reset_database(engine_t *e, const char *req_id) {
    if (!e) return -1;
    pthread_mutex_lock(&e->state_lock);
    if (e->sim_state == SIM_STATE_RUNNING || e->sim_state == SIM_STATE_PAUSED) {
        pthread_mutex_unlock(&e->state_lock);
        protocol_send_response(&e->protocol, req_id, false, NULL, "Cannot reset database while experiment is running");
        return -2;
    }

    int rc = db_reset_from_scripts(e->db_path, e->schema_path, e->seed_path);
    if (rc == 0) {
        metrics_reset(&e->metrics);
        protocol_send_event(&e->protocol,
                            "",
                            "SYSTEM",
                            "SYSTEM",
                            "DATABASE_RESET",
                            "IDLE",
                            "",
                            scheduler_policy_name(e->scheduler.policy),
                            0, 0, 0, 0,
                            get_monotonic_ms(), NULL);

        cJSON *resp = cJSON_CreateObject();
        cJSON_AddStringToObject(resp, "message", "Database reset to initial seed data successfully");
        protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    } else {
        protocol_send_response(&e->protocol, req_id, false, NULL, "Failed to reset database from scripts");
    }

    pthread_mutex_unlock(&e->state_lock);
    return rc;
}

cJSON* engine_get_status_json(engine_t *e) {
    if (!e) return NULL;

    cJSON *root = cJSON_CreateObject();
    pthread_mutex_lock(&e->state_lock);
    cJSON_AddStringToObject(root, "experiment_id", e->current_exp_id);
    switch (e->sim_state) {
        case SIM_STATE_IDLE:    cJSON_AddStringToObject(root, "sim_state", "IDLE"); break;
        case SIM_STATE_RUNNING: cJSON_AddStringToObject(root, "sim_state", "RUNNING"); break;
        case SIM_STATE_PAUSED:  cJSON_AddStringToObject(root, "sim_state", "PAUSED"); break;
        case SIM_STATE_STOPPED: cJSON_AddStringToObject(root, "sim_state", "STOPPED"); break;
    }
    cJSON_AddStringToObject(root, "policy", scheduler_policy_name(e->scheduler.policy));

    pthread_mutex_lock(&e->metrics.lock);
    cJSON *m = cJSON_CreateObject();
    cJSON_AddNumberToObject(m, "active_readers", e->metrics.active_readers);
    cJSON_AddNumberToObject(m, "active_writers", e->metrics.active_writers);
    cJSON_AddNumberToObject(m, "waiting_readers", e->metrics.waiting_readers);
    cJSON_AddNumberToObject(m, "waiting_writers", e->metrics.waiting_writers);
    cJSON_AddNumberToObject(m, "completed_readers", e->metrics.completed_readers);
    cJSON_AddNumberToObject(m, "completed_writers", e->metrics.completed_writers);
    cJSON_AddNumberToObject(m, "failed_operations", e->metrics.failed_operations);
    cJSON_AddNumberToObject(m, "cancelled_operations", e->metrics.cancelled_operations);
    cJSON_AddNumberToObject(m, "total_operations", e->metrics.total_operations);
    cJSON_AddNumberToObject(m, "max_simultaneous_readers", e->metrics.max_simultaneous_readers);
    cJSON_AddNumberToObject(m, "sync_violations", e->metrics.sync_violations);

    double avg_r_wait = (e->metrics.completed_readers > 0) ? (e->metrics.total_reader_wait_ms / e->metrics.completed_readers) : 0.0;
    double avg_w_wait = (e->metrics.completed_writers > 0) ? (e->metrics.total_writer_wait_ms / e->metrics.completed_writers) : 0.0;
    int total_done = e->metrics.completed_readers + e->metrics.completed_writers;
    double avg_exec = (total_done > 0) ? (e->metrics.total_execution_ms / total_done) : 0.0;

    cJSON_AddNumberToObject(m, "avg_reader_wait_ms", avg_r_wait);
    cJSON_AddNumberToObject(m, "avg_writer_wait_ms", avg_w_wait);
    cJSON_AddNumberToObject(m, "avg_execution_ms", avg_exec);
    cJSON_AddNumberToObject(m, "min_wait_ms", (e->metrics.min_wait_ms == 1e308 || e->metrics.min_wait_ms > 1e300) ? 0.0 : e->metrics.min_wait_ms);
    cJSON_AddNumberToObject(m, "max_wait_ms", e->metrics.max_wait_ms);
    pthread_mutex_unlock(&e->metrics.lock);

    cJSON_AddItemToObject(root, "metrics", m);
    pthread_mutex_unlock(&e->state_lock);
    return root;
}

cJSON* engine_get_snapshot_json(engine_t *e) {
    cJSON *root = engine_get_status_json(e);
    if (!root) return NULL;

    // Accounts list
    sqlite3 *db = NULL;
    if (db_open_conn(e->db_path, &db) == 0) {
        account_t *accounts = NULL;
        int acc_count = 0;
        if (db_list_accounts(db, &accounts, &acc_count) == 0) {
            cJSON *acc_arr = cJSON_CreateArray();
            for (int i = 0; i < acc_count; i++) {
                cJSON *a = cJSON_CreateObject();
                cJSON_AddStringToObject(a, "account_id", accounts[i].account_id);
                cJSON_AddStringToObject(a, "holder_name", accounts[i].holder_name);
                cJSON_AddNumberToObject(a, "balance_paise", (double)accounts[i].balance_paise);
                cJSON_AddNumberToObject(a, "balance_rupees", accounts[i].balance_paise / 100.0);
                cJSON_AddStringToObject(a, "created_at", accounts[i].created_at);
                cJSON_AddStringToObject(a, "updated_at", accounts[i].updated_at);
                cJSON_AddItemToArray(acc_arr, a);
            }
            cJSON_AddItemToObject(root, "accounts", acc_arr);
            free(accounts);
        }
        db_close_conn(db);
    }

    return root;
}

void engine_process_command(engine_t *e, const char *json_line) {
    if (!e || !json_line || strlen(json_line) == 0) return;

    cJSON *root = cJSON_Parse(json_line);
    if (!root) {
        protocol_send_response(&e->protocol, "", false, NULL, "Invalid JSON input");
        return;
    }

    cJSON *c_cmd = cJSON_GetObjectItem(root, "command");
    cJSON *c_req = cJSON_GetObjectItem(root, "req_id");
    cJSON *c_params = cJSON_GetObjectItem(root, "params");

    const char *cmd = (c_cmd && c_cmd->valuestring) ? c_cmd->valuestring : "";
    const char *req_id = (c_req && c_req->valuestring) ? c_req->valuestring : "";

    if (strcmp(cmd, "ping") == 0) {
        cJSON *resp = cJSON_CreateObject();
        cJSON_AddStringToObject(resp, "message", "pong");
        cJSON_AddNumberToObject(resp, "timestamp", (double)get_wall_clock_ms());
        protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    } else if (strcmp(cmd, "status") == 0) {
        cJSON *status = engine_get_status_json(e);
        protocol_send_response(&e->protocol, req_id, true, status, NULL);
    } else if (strcmp(cmd, "snapshot") == 0) {
        cJSON *snap = engine_get_snapshot_json(e);
        protocol_send_response(&e->protocol, req_id, true, snap, NULL);
    } else if (strcmp(cmd, "initialize_database") == 0 || strcmp(cmd, "reset_database") == 0) {
        engine_reset_database(e, req_id);
    } else if (strcmp(cmd, "list_accounts") == 0) {
        sqlite3 *db = NULL;
        if (db_open_conn(e->db_path, &db) == 0) {
            account_t *list = NULL;
            int count = 0;
            if (db_list_accounts(db, &list, &count) == 0) {
                cJSON *arr = cJSON_CreateArray();
                for (int i = 0; i < count; i++) {
                    cJSON *a = cJSON_CreateObject();
                    cJSON_AddStringToObject(a, "account_id", list[i].account_id);
                    cJSON_AddStringToObject(a, "holder_name", list[i].holder_name);
                    cJSON_AddNumberToObject(a, "balance_paise", (double)list[i].balance_paise);
                    cJSON_AddNumberToObject(a, "balance_rupees", list[i].balance_paise / 100.0);
                    cJSON_AddStringToObject(a, "created_at", list[i].created_at);
                    cJSON_AddStringToObject(a, "updated_at", list[i].updated_at);
                    cJSON_AddItemToArray(arr, a);
                }
                free(list);
                cJSON *data = cJSON_CreateObject();
                cJSON_AddItemToObject(data, "accounts", arr);
                cJSON_AddNumberToObject(data, "count", count);
                protocol_send_response(&e->protocol, req_id, true, data, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, "Failed to list accounts");
            }
            db_close_conn(db);
        } else {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Could not connect to database");
        }
    } else if (strcmp(cmd, "read_account") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        if (!c_aid || !c_aid->valuestring) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing account_id");
        } else {
            // Manual read operation executes under real reader lock
            double wait_ms = 0.0;
            scheduler_reader_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            account_t acc;
            int rc = db_get_account(db, c_aid->valuestring, &acc);
            db_close_conn(db);
            scheduler_reader_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "account_id", acc.account_id);
                cJSON_AddStringToObject(resp, "holder_name", acc.holder_name);
                cJSON_AddNumberToObject(resp, "balance_paise", (double)acc.balance_paise);
                cJSON_AddNumberToObject(resp, "balance_rupees", acc.balance_paise / 100.0);
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, "Account not found");
            }
        }
    } else if (strcmp(cmd, "create_account") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        cJSON *c_name = cJSON_GetObjectItem(c_params, "holder_name");
        cJSON *c_bal = cJSON_GetObjectItem(c_params, "balance_paise");
        if (!c_aid || !c_name || !c_bal) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing account creation fields");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_create_account(db, c_aid->valuestring, c_name->valuestring, (int64_t)c_bal->valuedouble, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "account_id", c_aid->valuestring);
                cJSON_AddStringToObject(resp, "message", "Account created successfully");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Failed to create account");
            }
        }
    } else if (strcmp(cmd, "update_account") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        cJSON *c_name = cJSON_GetObjectItem(c_params, "holder_name");
        if (!c_aid || !c_name) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing account update fields");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_update_account(db, c_aid->valuestring, c_name->valuestring, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "message", "Account updated successfully");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Failed to update account");
            }
        }
    } else if (strcmp(cmd, "delete_account") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        if (!c_aid) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing account_id for delete");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_delete_account(db, c_aid->valuestring, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "message", "Account deleted successfully");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Failed to delete account");
            }
        }
    } else if (strcmp(cmd, "deposit") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        cJSON *c_amt = cJSON_GetObjectItem(c_params, "amount_paise");
        if (!c_aid || !c_amt) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing deposit parameters");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_deposit(db, c_aid->valuestring, (int64_t)c_amt->valuedouble, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "message", "Deposit completed successfully");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Deposit failed");
            }
        }
    } else if (strcmp(cmd, "withdraw") == 0) {
        cJSON *c_aid = cJSON_GetObjectItem(c_params, "account_id");
        cJSON *c_amt = cJSON_GetObjectItem(c_params, "amount_paise");
        if (!c_aid || !c_amt) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing withdrawal parameters");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_withdraw(db, c_aid->valuestring, (int64_t)c_amt->valuedouble, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "message", "Withdrawal completed successfully");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Withdrawal failed");
            }
        }
    } else if (strcmp(cmd, "transfer") == 0) {
        cJSON *c_src = cJSON_GetObjectItem(c_params, "source_account");
        cJSON *c_dst = cJSON_GetObjectItem(c_params, "destination_account");
        cJSON *c_amt = cJSON_GetObjectItem(c_params, "amount_paise");
        if (!c_src || !c_dst || !c_amt) {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Missing transfer parameters");
        } else {
            double wait_ms = 0.0;
            scheduler_writer_lock(&e->scheduler, req_id, &wait_ms);
            sqlite3 *db = NULL;
            db_open_conn(e->db_path, &db);
            char err[256] = {0};
            int rc = db_transfer(db, c_src->valuestring, c_dst->valuestring, (int64_t)c_amt->valuedouble, req_id, err, sizeof(err));
            db_close_conn(db);
            scheduler_writer_unlock(&e->scheduler, req_id, 10.0, (rc == 0));

            if (rc == 0) {
                cJSON *resp = cJSON_CreateObject();
                cJSON_AddStringToObject(resp, "message", "Transfer completed atomically");
                protocol_send_response(&e->protocol, req_id, true, resp, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, err[0] ? err : "Transfer failed");
            }
        }
    } else if (strcmp(cmd, "list_transactions") == 0) {
        cJSON *c_lim = cJSON_GetObjectItem(c_params, "limit");
        int lim = (c_lim && c_lim->valueint > 0) ? c_lim->valueint : 100;
        sqlite3 *db = NULL;
        if (db_open_conn(e->db_path, &db) == 0) {
            transaction_t *txns = NULL;
            int count = 0;
            if (db_list_transactions(db, &txns, &count, lim) == 0) {
                cJSON *arr = cJSON_CreateArray();
                for (int i = 0; i < count; i++) {
                    cJSON *t = cJSON_CreateObject();
                    cJSON_AddStringToObject(t, "transaction_id", txns[i].transaction_id);
                    cJSON_AddStringToObject(t, "transaction_type", txns[i].transaction_type);
                    cJSON_AddStringToObject(t, "source_account", txns[i].source_account);
                    cJSON_AddStringToObject(t, "destination_account", txns[i].destination_account);
                    cJSON_AddNumberToObject(t, "amount_paise", (double)txns[i].amount_paise);
                    cJSON_AddNumberToObject(t, "amount_rupees", txns[i].amount_paise / 100.0);
                    cJSON_AddStringToObject(t, "operation_id", txns[i].operation_id);
                    cJSON_AddStringToObject(t, "status", txns[i].status);
                    cJSON_AddStringToObject(t, "details", txns[i].details);
                    cJSON_AddStringToObject(t, "created_at", txns[i].created_at);
                    cJSON_AddItemToArray(arr, t);
                }
                free(txns);
                cJSON *data = cJSON_CreateObject();
                cJSON_AddItemToObject(data, "transactions", arr);
                cJSON_AddNumberToObject(data, "count", count);
                protocol_send_response(&e->protocol, req_id, true, data, NULL);
            } else {
                protocol_send_response(&e->protocol, req_id, false, NULL, "Failed to list transactions");
            }
            db_close_conn(db);
        } else {
            protocol_send_response(&e->protocol, req_id, false, NULL, "Could not open database");
        }
    } else if (strcmp(cmd, "start_simulation") == 0) {
        engine_start_simulation(e, c_params, req_id);
    } else if (strcmp(cmd, "pause_simulation") == 0) {
        engine_pause_simulation(e, req_id);
    } else if (strcmp(cmd, "resume_simulation") == 0) {
        engine_resume_simulation(e, req_id);
    } else if (strcmp(cmd, "stop_simulation") == 0) {
        engine_stop_simulation(e, req_id);
    } else if (strcmp(cmd, "shutdown") == 0) {
        e->is_shutting_down = true;
        cJSON *resp = cJSON_CreateObject();
        cJSON_AddStringToObject(resp, "message", "Engine shutting down cleanly");
        protocol_send_response(&e->protocol, req_id, true, resp, NULL);
    } else {
        char err[128];
        snprintf(err, sizeof(err), "Unknown command '%s'", cmd);
        protocol_send_response(&e->protocol, req_id, false, NULL, err);
    }

    cJSON_Delete(root);
}

void engine_run_loop(engine_t *e) {
    if (!e) return;
    char line_buffer[16384];

    while (!e->is_shutting_down && fgets(line_buffer, sizeof(line_buffer), stdin)) {
        // Strip trailing newline/carriage return
        size_t len = strlen(line_buffer);
        while (len > 0 && (line_buffer[len - 1] == '\n' || line_buffer[len - 1] == '\r')) {
            line_buffer[--len] = '\0';
        }
        if (len == 0) continue;

        engine_process_command(e, line_buffer);
    }
}
