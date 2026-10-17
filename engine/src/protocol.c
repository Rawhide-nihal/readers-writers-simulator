#include "protocol.h"
#include "metrics.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

void protocol_init(protocol_channel_t *chan) {
    if (!chan) return;
    pthread_mutex_init(&chan->send_lock, NULL);
    chan->sequence_number = 0;
}

void protocol_destroy(protocol_channel_t *chan) {
    if (!chan) return;
    pthread_mutex_destroy(&chan->send_lock);
}

void protocol_send_response(protocol_channel_t *chan, const char *req_id, bool success, cJSON *data, const char *error_msg) {
    if (!chan) return;

    pthread_mutex_lock(&chan->send_lock);
    chan->sequence_number++;

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "type", "response");
    cJSON_AddNumberToObject(root, "seq", (double)chan->sequence_number);
    cJSON_AddNumberToObject(root, "timestamp_ms", (double)get_wall_clock_ms());
    cJSON_AddStringToObject(root, "req_id", req_id ? req_id : "");
    cJSON_AddBoolToObject(root, "success", success);

    if (data) {
        cJSON_AddItemToObject(root, "data", data);
    } else {
        cJSON_AddNullToObject(root, "data");
    }

    if (error_msg) {
        cJSON_AddStringToObject(root, "error", error_msg);
    } else {
        cJSON_AddNullToObject(root, "error");
    }

    char *json_str = cJSON_PrintUnformatted(root);
    if (json_str) {
        fputs(json_str, stdout);
        fputc('\n', stdout);
        fflush(stdout);
        free(json_str);
    }
    cJSON_Delete(root);

    pthread_mutex_unlock(&chan->send_lock);
}

void protocol_send_event(protocol_channel_t *chan,
                         const char *experiment_id,
                         const char *op_id,
                         const char *role,
                         const char *event_type,
                         const char *state,
                         const char *account_id,
                         const char *policy,
                         int active_readers,
                         int active_writers,
                         int waiting_readers,
                         int waiting_writers,
                         double monotonic_ms,
                         cJSON *extra_info) {
    if (!chan) return;

    pthread_mutex_lock(&chan->send_lock);
    chan->sequence_number++;

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "type", "event");
    cJSON_AddNumberToObject(root, "seq", (double)chan->sequence_number);
    cJSON_AddNumberToObject(root, "timestamp_ms", (double)get_wall_clock_ms());
    cJSON_AddNumberToObject(root, "monotonic_ms", monotonic_ms);
    cJSON_AddStringToObject(root, "exp_id", experiment_id ? experiment_id : "");
    cJSON_AddStringToObject(root, "op_id", op_id ? op_id : "");
    cJSON_AddStringToObject(root, "role", role ? role : "");
    cJSON_AddStringToObject(root, "event", event_type ? event_type : "");
    cJSON_AddStringToObject(root, "state", state ? state : "");
    cJSON_AddStringToObject(root, "account_id", account_id ? account_id : "");
    cJSON_AddStringToObject(root, "policy", policy ? policy : "");

    cJSON *metrics = cJSON_CreateObject();
    cJSON_AddNumberToObject(metrics, "active_readers", active_readers);
    cJSON_AddNumberToObject(metrics, "active_writers", active_writers);
    cJSON_AddNumberToObject(metrics, "waiting_readers", waiting_readers);
    cJSON_AddNumberToObject(metrics, "waiting_writers", waiting_writers);
    cJSON_AddItemToObject(root, "metrics", metrics);

    if (extra_info) {
        cJSON_AddItemToObject(root, "details", extra_info);
    }

    char *json_str = cJSON_PrintUnformatted(root);
    if (json_str) {
        fputs(json_str, stdout);
        fputc('\n', stdout);
        fflush(stdout);
        free(json_str);
    }
    cJSON_Delete(root);

    pthread_mutex_unlock(&chan->send_lock);
}

void protocol_log_debug(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    fprintf(stderr, "[ENGINE DEBUG] ");
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
    va_end(args);
    fflush(stderr);
}

void protocol_log_error(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    fprintf(stderr, "[ENGINE ERROR] ");
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
    va_end(args);
    fflush(stderr);
}
