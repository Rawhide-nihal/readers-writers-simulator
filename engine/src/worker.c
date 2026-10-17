#define _POSIX_C_SOURCE 199309L
#include "worker.h"
#include "engine.h"
#include "database.h"
#include "protocol.h"
#include "metrics.h"
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void sleep_ms(int ms) {
    if (ms <= 0) return;
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

void* worker_thread_entry(void *arg) {
    worker_task_t *task = (worker_task_t*)arg;
    if (!task || !task->engine) return NULL;
    engine_t *engine = task->engine;

    // Optional staggered arrival delay
    if (task->arrival_delay_ms > 0) {
        sleep_ms(task->arrival_delay_ms);
    }

    if (scheduler_is_stopped(&engine->scheduler)) {
        task->is_cancelled = true;
        engine_emit_worker_event(engine, task, "CANCELLED", "CANCELLED", NULL);
        return NULL;
    }

    task->arrival_time_ms = get_monotonic_ms();

    // 1. Emit QUEUED / WAITING event
    cJSON *queued_details = cJSON_CreateObject();
    cJSON_AddStringToObject(queued_details, "info", "Waiting for lock acquisition");
    engine_emit_worker_event(engine, task, "QUEUED", "WAITING", queued_details);

    // 2. Request synchronization lock
    double wait_ms = 0.0;
    int lock_rc = 0;
    if (task->role == ROLE_READER) {
        lock_rc = scheduler_reader_lock(&engine->scheduler, task->op_id, &wait_ms);
    } else {
        lock_rc = scheduler_writer_lock(&engine->scheduler, task->op_id, &wait_ms);
    }

    if (lock_rc != 0) {
        task->is_cancelled = true;
        cJSON *cancel_info = cJSON_CreateObject();
        cJSON_AddStringToObject(cancel_info, "reason", "Lock acquisition cancelled or stopped");
        engine_emit_worker_event(engine, task, "CANCELLED", "CANCELLED", cancel_info);
        return NULL;
    }

    // 3. Lock Acquired!
    task->acquired_time_ms = get_monotonic_ms();
    cJSON *acq_info = cJSON_CreateObject();
    cJSON_AddNumberToObject(acq_info, "wait_duration_ms", wait_ms);
    engine_emit_worker_event(engine, task, "ACQUIRED", (task->role == ROLE_READER ? "READING" : "WRITING"), acq_info);

    // 4. Open thread-specific SQLite connection
    sqlite3 *db = NULL;
    int db_open_rc = db_open_conn(engine->db_path, &db);
    int op_success = 0;
    cJSON *result_data = cJSON_CreateObject();

    if (db_open_rc != 0 || !db) {
        op_success = -1;
        cJSON_AddStringToObject(result_data, "error", "Failed to open thread database connection");
    } else {
        if (task->role == ROLE_READER) {
            // Read Operation
            engine_emit_worker_event(engine, task, "DB_READ_START", "READING", NULL);
            account_t acc;
            memset(&acc, 0, sizeof(account_t));
            int r_rc = db_get_account(db, task->account_id, &acc);
            
            // Teaching workload duration to make concurrency visible
            sleep_ms(task->workload_ms);

            if (r_rc == 0) {
                op_success = 0;
                cJSON_AddStringToObject(result_data, "account_id", acc.account_id);
                cJSON_AddStringToObject(result_data, "holder_name", acc.holder_name);
                cJSON_AddNumberToObject(result_data, "balance_paise", (double)acc.balance_paise);
                cJSON_AddNumberToObject(result_data, "balance_rupees", acc.balance_paise / 100.0);
            } else {
                op_success = -2;
                cJSON_AddStringToObject(result_data, "error", "Account not found or read error");
            }
            engine_emit_worker_event(engine, task, "DB_READ_END", "READING", NULL);
        } else {
            // Writer Operation
            engine_emit_worker_event(engine, task, "DB_WRITE_START", "WRITING", NULL);
            char err_buf[256] = {0};
            int w_rc = 0;

            if (task->op_type == OP_TYPE_DEPOSIT) {
                w_rc = db_deposit(db, task->account_id, task->amount_paise, task->op_id, err_buf, sizeof(err_buf));
            } else if (task->op_type == OP_TYPE_WITHDRAW) {
                w_rc = db_withdraw(db, task->account_id, task->amount_paise, task->op_id, err_buf, sizeof(err_buf));
            } else if (task->op_type == OP_TYPE_TRANSFER) {
                w_rc = db_transfer(db, task->account_id, task->target_account_id, task->amount_paise, task->op_id, err_buf, sizeof(err_buf));
            } else {
                snprintf(err_buf, sizeof(err_buf), "Unknown write op_type %d", task->op_type);
                w_rc = -1;
            }

            // Teaching workload duration to make concurrency visible
            sleep_ms(task->workload_ms);

            if (w_rc == 0) {
                op_success = 0;
                cJSON_AddStringToObject(result_data, "status", "COMMITTED");
                cJSON_AddNumberToObject(result_data, "amount_paise", (double)task->amount_paise);
            } else {
                op_success = -3;
                cJSON_AddStringToObject(result_data, "status", "ROLLED_BACK");
                cJSON_AddStringToObject(result_data, "error", err_buf);
            }
            engine_emit_worker_event(engine, task, "DB_WRITE_END", "WRITING", NULL);
        }

        db_close_conn(db);
    }

    // 5. Release synchronization lock
    task->release_time_ms = get_monotonic_ms();
    double exec_ms = task->release_time_ms - task->acquired_time_ms;
    cJSON_AddNumberToObject(result_data, "execution_duration_ms", exec_ms);
    cJSON_AddNumberToObject(result_data, "wait_duration_ms", wait_ms);

    engine_emit_worker_event(engine, task, "RELEASING", "RELEASING", NULL);

    if (task->role == ROLE_READER) {
        scheduler_reader_unlock(&engine->scheduler, task->op_id, exec_ms, (op_success == 0));
    } else {
        scheduler_writer_unlock(&engine->scheduler, task->op_id, exec_ms, (op_success == 0));
    }

    // 6. Final status event
    if (op_success == 0) {
        engine_emit_worker_event(engine, task, "COMPLETED", "COMPLETED", result_data);
    } else {
        engine_emit_worker_event(engine, task, "FAILED", "FAILED", result_data);
    }

    return NULL;
}
