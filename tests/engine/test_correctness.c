#define _POSIX_C_SOURCE 199309L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <unistd.h>
#include <pthread.h>
#include "scheduler.h"
#include "database.h"
#include "metrics.h"

static int g_tests_passed = 0;
static int g_tests_total = 0;

#define TEST_ASSERT(cond, msg) do { \
    g_tests_total++; \
    if (!(cond)) { \
        fprintf(stderr, "FAILED: %s (line %d)\n", msg, __LINE__); \
        assert(cond); \
    } else { \
        g_tests_passed++; \
        printf("  [PASS] %s\n", msg); \
    } \
} while(0)

// Helper thread struct for concurrent tests
typedef struct {
    scheduler_t *s;
    bool is_writer;
    int hold_ms;
    bool lock_acquired;
    bool success;
} test_worker_t;

static void* test_thread_worker(void *arg) {
    test_worker_t *w = (test_worker_t*)arg;
    double wait_ms = 0;
    int rc = 0;
    if (w->is_writer) {
        rc = scheduler_writer_lock(w->s, "TEST_OP", &wait_ms);
    } else {
        rc = scheduler_reader_lock(w->s, "TEST_OP", &wait_ms);
    }

    if (rc == 0) {
        w->lock_acquired = true;
        if (w->hold_ms > 0) {
            usleep(w->hold_ms * 1000);
        }
        if (w->is_writer) {
            scheduler_writer_unlock(w->s, "TEST_OP", 10.0, 1);
        } else {
            scheduler_reader_unlock(w->s, "TEST_OP", 10.0, 1);
        }
        w->success = true;
    } else {
        w->success = false;
    }
    return NULL;
}

// -------------------------------------------------------------
// Test 1: Single Reader
// -------------------------------------------------------------
void test_single_reader(void) {
    printf("\n--- Test: Single Reader ---\n");
    engine_metrics_t m;
    metrics_init(&m);
    scheduler_t s;
    scheduler_init(&s, POLICY_READER_PREF, &m);

    double wait_ms = 0;
    int rc = scheduler_reader_lock(&s, "T1", &wait_ms);
    TEST_ASSERT(rc == 0, "Single reader acquired lock");
    TEST_ASSERT(m.active_readers == 1, "Active readers count is 1");
    TEST_ASSERT(m.active_writers == 0, "Active writers count is 0");
    TEST_ASSERT(scheduler_verify_invariants(&s, "single_reader"), "Invariants hold");

    rc = scheduler_reader_unlock(&s, "T1", 5.0, 1);
    TEST_ASSERT(rc == 0, "Single reader released lock");
    TEST_ASSERT(m.active_readers == 0, "Active readers count is 0 after release");

    scheduler_destroy(&s);
    metrics_destroy(&m);
}

// -------------------------------------------------------------
// Test 2: Multiple Simultaneous Readers (Sharing)
// -------------------------------------------------------------
void test_multiple_readers(void) {
    printf("\n--- Test: Multiple Simultaneous Readers ---\n");
    engine_metrics_t m;
    metrics_init(&m);
    scheduler_t s;
    scheduler_init(&s, POLICY_READER_PREF, &m);

    double wait_ms = 0;
    scheduler_reader_lock(&s, "R1", &wait_ms);
    scheduler_reader_lock(&s, "R2", &wait_ms);
    scheduler_reader_lock(&s, "R3", &wait_ms);

    TEST_ASSERT(m.active_readers == 3, "All 3 readers active simultaneously");
    TEST_ASSERT(m.active_writers == 0, "Zero active writers while readers active");
    TEST_ASSERT(scheduler_verify_invariants(&s, "multiple_readers"), "Invariants hold with 3 readers");

    scheduler_reader_unlock(&s, "R1", 5.0, 1);
    scheduler_reader_unlock(&s, "R2", 5.0, 1);
    scheduler_reader_unlock(&s, "R3", 5.0, 1);

    TEST_ASSERT(m.active_readers == 0, "Readers decremented to 0");
    scheduler_destroy(&s);
    metrics_destroy(&m);
}

// -------------------------------------------------------------
// Test 3: Single Writer Exclusivity
// -------------------------------------------------------------
void test_single_writer(void) {
    printf("\n--- Test: Single Writer Exclusivity ---\n");
    engine_metrics_t m;
    metrics_init(&m);
    scheduler_t s;
    scheduler_init(&s, POLICY_READER_PREF, &m);

    double wait_ms = 0;
    int rc = scheduler_writer_lock(&s, "W1", &wait_ms);
    TEST_ASSERT(rc == 0, "Writer acquired exclusive lock");
    TEST_ASSERT(m.active_writers == 1, "Active writers count is exactly 1");
    TEST_ASSERT(m.active_readers == 0, "Active readers count is 0");
    TEST_ASSERT(scheduler_verify_invariants(&s, "single_writer"), "Invariants hold for writer");

    rc = scheduler_writer_unlock(&s, "W1", 10.0, 1);
    TEST_ASSERT(rc == 0, "Writer released lock");
    TEST_ASSERT(m.active_writers == 0, "Active writers count is 0");

    scheduler_destroy(&s);
    metrics_destroy(&m);
}

// -------------------------------------------------------------
// Test 4: Concurrency & Invariants under Thread Contention
// -------------------------------------------------------------
void test_concurrent_threads(sync_policy_t policy, const char *policy_name) {
    printf("\n--- Test: Concurrent Threads (%s) ---\n", policy_name);
    engine_metrics_t m;
    metrics_init(&m);
    scheduler_t s;
    scheduler_init(&s, policy, &m);

    const int NUM_THREADS = 10;
    pthread_t threads[NUM_THREADS];
    test_worker_t workers[NUM_THREADS];

    for (int i = 0; i < NUM_THREADS; i++) {
        workers[i].s = &s;
        workers[i].is_writer = (i % 3 == 0); // Mix of readers and writers
        workers[i].hold_ms = 20;
        workers[i].lock_acquired = false;
        workers[i].success = false;
        pthread_create(&threads[i], NULL, test_thread_worker, &workers[i]);
    }

    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
        TEST_ASSERT(workers[i].success == true, "Thread executed and released successfully");
    }

    TEST_ASSERT(m.sync_violations == 0, "Zero synchronization violations occurred");
    TEST_ASSERT(m.active_readers == 0 && m.active_writers == 0, "Clean cleanup of all threads");

    scheduler_destroy(&s);
    metrics_destroy(&m);
}

// -------------------------------------------------------------
// Test 5: Cancellation & Safe Shutdown
// -------------------------------------------------------------
void test_cancellation(void) {
    printf("\n--- Test: Cancellation & Safe Stop ---\n");
    engine_metrics_t m;
    metrics_init(&m);
    scheduler_t s;
    scheduler_init(&s, POLICY_FAIR, &m);

    double wait_ms = 0;
    // Writer takes lock
    scheduler_writer_lock(&s, "W_HOLD", &wait_ms);

    // Queue another writer in background
    test_worker_t queued_w;
    queued_w.s = &s;
    queued_w.is_writer = true;
    queued_w.hold_ms = 10;
    queued_w.lock_acquired = false;
    queued_w.success = false;

    pthread_t th;
    pthread_create(&th, NULL, test_thread_worker, &queued_w);
    usleep(50000); // Give time to queue

    // Now stop scheduler (cancellation)
    scheduler_stop(&s);

    // Release holder
    scheduler_writer_unlock(&s, "W_HOLD", 10.0, 1);

    pthread_join(th, NULL);
    TEST_ASSERT(scheduler_is_stopped(&s), "Scheduler registered stopped state");

    scheduler_destroy(&s);
    metrics_destroy(&m);
}

// -------------------------------------------------------------
// Test 6: Database ACID Operations & Atomic Transfer
// -------------------------------------------------------------
void test_database_operations(void) {
    printf("\n--- Test: Database Operations & Atomic Transfers ---\n");
    const char *test_db = "/tmp/syncdb_test.sqlite3";
    unlink(test_db);

    int rc = db_reset_from_scripts(test_db, "database/schema.sql", "database/seed.sql");
    TEST_ASSERT(rc == 0, "Database reset from schema.sql and seed.sql succeeded");

    sqlite3 *db = NULL;
    rc = db_open_conn(test_db, &db);
    TEST_ASSERT(rc == 0 && db != NULL, "Opened connection to test SQLite database");

    // Verify initial seed balance for ACC001 (₹10,000 = 1,000,000 paise)
    account_t a1;
    rc = db_get_account(db, "ACC001", &a1);
    TEST_ASSERT(rc == 0, "Found seeded account ACC001");
    TEST_ASSERT(a1.balance_paise == 1000000, "ACC001 initial balance is ₹10,000");

    // Deposit ₹5,000 (500,000 paise)
    char err[256] = {0};
    rc = db_deposit(db, "ACC001", 500000, "TEST_DEP", err, sizeof(err));
    TEST_ASSERT(rc == 0, "Deposit of ₹5,000 to ACC001 succeeded");
    db_get_account(db, "ACC001", &a1);
    TEST_ASSERT(a1.balance_paise == 1500000, "ACC001 new balance is ₹15,000");

    // Withdrawal ₹3,000 (300,000 paise)
    rc = db_withdraw(db, "ACC001", 300000, "TEST_WTH", err, sizeof(err));
    TEST_ASSERT(rc == 0, "Withdrawal of ₹3,000 from ACC001 succeeded");
    db_get_account(db, "ACC001", &a1);
    TEST_ASSERT(a1.balance_paise == 1200000, "ACC001 new balance is ₹12,000");

    // Insufficient balance rejection
    rc = db_withdraw(db, "ACC001", 999999999, "TEST_FAIL_WTH", err, sizeof(err));
    TEST_ASSERT(rc != 0, "Overdraft correctly rejected with insufficient funds error");
    db_get_account(db, "ACC001", &a1);
    TEST_ASSERT(a1.balance_paise == 1200000, "Balance unchanged after failed withdrawal");

    // Atomic transfer: ACC001 -> ACC002 ₹2,000 (200,000 paise)
    account_t a2_before;
    db_get_account(db, "ACC002", &a2_before);
    rc = db_transfer(db, "ACC001", "ACC002", 200000, "TEST_TRF", err, sizeof(err));
    TEST_ASSERT(rc == 0, "Atomic transfer of ₹2,000 from ACC001 to ACC002 committed");

    account_t a1_after, a2_after;
    db_get_account(db, "ACC001", &a1_after);
    db_get_account(db, "ACC002", &a2_after);
    TEST_ASSERT(a1_after.balance_paise == 1000000, "ACC001 correctly debited to ₹10,000");
    TEST_ASSERT(a2_after.balance_paise == a2_before.balance_paise + 200000, "ACC002 correctly credited");

    // Verify transactions logged
    transaction_t *txns = NULL;
    int txn_cnt = 0;
    rc = db_list_transactions(db, &txns, &txn_cnt, 50);
    TEST_ASSERT(rc == 0 && txn_cnt >= 4, "Transaction log records created");
    free(txns);

    db_close_conn(db);
    unlink(test_db);
}

int main(void) {
    printf("==================================================\n");
    printf("SyncDB Lab - C Correctness & Invariant Test Suite\n");
    printf("Group G-15 (Readers-Writers Concurrency Project)\n");
    printf("==================================================\n");

    test_single_reader();
    test_multiple_readers();
    test_single_writer();
    test_concurrent_threads(POLICY_READER_PREF, "Reader Preference");
    test_concurrent_threads(POLICY_WRITER_PREF, "Writer Preference");
    test_concurrent_threads(POLICY_FAIR, "Fair FIFO Scheduling");
    test_cancellation();
    test_database_operations();

    printf("\n==================================================\n");
    printf("ALL TESTS COMPLETED: %d / %d PASSED\n", g_tests_passed, g_tests_total);
    printf("==================================================\n");
    return (g_tests_passed == g_tests_total) ? 0 : 1;
}
