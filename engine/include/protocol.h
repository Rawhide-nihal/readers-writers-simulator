#ifndef SYNCDB_PROTOCOL_H
#define SYNCDB_PROTOCOL_H

#include <cjson/cJSON.h>
#include <stdbool.h>
#include <stdint.h>
#include <pthread.h>

typedef struct {
    pthread_mutex_t send_lock;
    uint64_t sequence_number;
} protocol_channel_t;

void protocol_init(protocol_channel_t *chan);
void protocol_destroy(protocol_channel_t *chan);

// Send correlated response for a request
void protocol_send_response(protocol_channel_t *chan, const char *req_id, bool success, cJSON *data, const char *error_msg);

// Send asynchronous real-time event to FastAPI backend
void protocol_send_event(protocol_channel_t *chan,
                         const char *experiment_id,
                         const char *op_id,
                         const char *role,         // "READER" or "WRITER"
                         const char *event_type,   // "CREATED", "QUEUED", "ACQUIRED", "RELEASED", etc.
                         const char *state,        // "WAITING", "READING", "WRITING", "COMPLETED", etc.
                         const char *account_id,
                         const char *policy,
                         int active_readers,
                         int active_writers,
                         int waiting_readers,
                         int waiting_writers,
                         double monotonic_ms,
                         cJSON *extra_info);

// Diagnostics to stderr
void protocol_log_debug(const char *fmt, ...);
void protocol_log_error(const char *fmt, ...);

#endif // SYNCDB_PROTOCOL_H
