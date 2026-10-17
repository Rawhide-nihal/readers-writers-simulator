#define _POSIX_C_SOURCE 200809L
#include "engine.h"
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <string.h>

static engine_t g_engine;

static void handle_signal(int sig) {
    (void)sig;
    g_engine.is_shutting_down = true;
    scheduler_stop(&g_engine.scheduler);
}

int main(int argc, char **argv) {
    const char *db_path = "database/syncdb.sqlite3";
    const char *schema_path = "database/schema.sql";
    const char *seed_path = "database/seed.sql";

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--db") == 0 && i + 1 < argc) {
            db_path = argv[++i];
        } else if (strcmp(argv[i], "--schema") == 0 && i + 1 < argc) {
            schema_path = argv[++i];
        } else if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
            seed_path = argv[++i];
        }
    }

    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = handle_signal;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    if (engine_init(&g_engine, db_path, schema_path, seed_path) != 0) {
        fprintf(stderr, "[FATAL] Failed to initialize SyncDB C Engine\n");
        return 1;
    }

    fprintf(stderr, "[ENGINE] SyncDB Lab POSIX Engine initialized (Group G-15)\n");
    fprintf(stderr, "[ENGINE] SQLite DB: %s\n", db_path);

    // Send initial ready event
    protocol_send_event(&g_engine.protocol,
                        "",
                        "SYSTEM",
                        "SYSTEM",
                        "ENGINE_READY",
                        "IDLE",
                        "",
                        "READER_PREFERENCE",
                        0, 0, 0, 0,
                        get_monotonic_ms(),
                        NULL);

    engine_run_loop(&g_engine);

    fprintf(stderr, "[ENGINE] Shutting down...\n");
    engine_destroy(&g_engine);
    fprintf(stderr, "[ENGINE] Shutdown complete.\n");

    return 0;
}
