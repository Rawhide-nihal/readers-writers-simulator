#include "database.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static void generate_txn_id(char *buf, size_t size, const char *prefix) {
    static int counter = 0;
    snprintf(buf, size, "TXN-%s-%ld-%04d", prefix ? prefix : "GEN", (long)time(NULL), ++counter);
}

static char* read_entire_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = malloc(sz + 1);
    if (!buf) {
        fclose(f);
        return NULL;
    }
    size_t read_bytes = fread(buf, 1, sz, f);
    buf[read_bytes] = '\0';
    fclose(f);
    return buf;
}

int db_open_conn(const char *db_path, sqlite3 **db) {
    if (!db_path || !db) return -1;
    int rc = sqlite3_open_v2(db_path, db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, NULL);
    if (rc != SQLITE_OK) {
        return -1;
    }
    sqlite3_busy_timeout(*db, 10000);
    sqlite3_exec(*db, "PRAGMA foreign_keys = ON;", NULL, NULL, NULL);
    sqlite3_exec(*db, "PRAGMA journal_mode = WAL;", NULL, NULL, NULL);
    return 0;
}

void db_close_conn(sqlite3 *db) {
    if (db) {
        sqlite3_close_v2(db);
    }
}

int db_init(const char *db_path) {
    sqlite3 *db = NULL;
    if (db_open_conn(db_path, &db) != 0) {
        return -1;
    }
    db_close_conn(db);
    return 0;
}

int db_reset_from_scripts(const char *db_path, const char *schema_file, const char *seed_file) {
    sqlite3 *db = NULL;
    if (db_open_conn(db_path, &db) != 0) {
        return -1;
    }

    char *schema_sql = read_entire_file(schema_file);
    char *seed_sql = read_entire_file(seed_file);

    if (!schema_sql || !seed_sql) {
        if (schema_sql) free(schema_sql);
        if (seed_sql) free(seed_sql);
        db_close_conn(db);
        return -2;
    }

    char *err_msg = NULL;
    int rc = sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, &err_msg);
    if (rc == SQLITE_OK) {
        rc = sqlite3_exec(db, schema_sql, NULL, NULL, &err_msg);
        if (rc == SQLITE_OK) {
            rc = sqlite3_exec(db, seed_sql, NULL, NULL, &err_msg);
        }
    }

    if (rc == SQLITE_OK) {
        sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    } else {
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        if (err_msg) {
            fprintf(stderr, "[DB ERROR] reset failed: %s\n", err_msg);
            sqlite3_free(err_msg);
        }
    }

    free(schema_sql);
    free(seed_sql);
    db_close_conn(db);
    return (rc == SQLITE_OK) ? 0 : -3;
}

int db_get_account(sqlite3 *db, const char *acc_id, account_t *out) {
    if (!db || !acc_id || !out) return -1;
    const char *sql = "SELECT account_id, holder_name, balance_paise, created_at, updated_at FROM accounts WHERE account_id = ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return -1;
    }

    sqlite3_bind_text(stmt, 1, acc_id, -1, SQLITE_STATIC);
    int rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        strncpy(out->account_id, (const char*)sqlite3_column_text(stmt, 0), sizeof(out->account_id) - 1);
        strncpy(out->holder_name, (const char*)sqlite3_column_text(stmt, 1), sizeof(out->holder_name) - 1);
        out->balance_paise = sqlite3_column_int64(stmt, 2);
        strncpy(out->created_at, (const char*)sqlite3_column_text(stmt, 3), sizeof(out->created_at) - 1);
        strncpy(out->updated_at, (const char*)sqlite3_column_text(stmt, 4), sizeof(out->updated_at) - 1);
        sqlite3_finalize(stmt);
        return 0;
    }

    sqlite3_finalize(stmt);
    return -2; // Not found
}

int db_list_accounts(sqlite3 *db, account_t **out, int *count) {
    if (!db || !out || !count) return -1;
    *out = NULL;
    *count = 0;

    const char *sql = "SELECT account_id, holder_name, balance_paise, created_at, updated_at FROM accounts ORDER BY account_id ASC;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return -1;
    }

    int capacity = 16;
    account_t *list = malloc(sizeof(account_t) * capacity);
    if (!list) {
        sqlite3_finalize(stmt);
        return -1;
    }

    int n = 0;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        if (n >= capacity) {
            capacity *= 2;
            account_t *new_list = realloc(list, sizeof(account_t) * capacity);
            if (!new_list) {
                free(list);
                sqlite3_finalize(stmt);
                return -1;
            }
            list = new_list;
        }
        memset(&list[n], 0, sizeof(account_t));
        const char *aid = (const char*)sqlite3_column_text(stmt, 0);
        const char *name = (const char*)sqlite3_column_text(stmt, 1);
        const char *c_at = (const char*)sqlite3_column_text(stmt, 3);
        const char *u_at = (const char*)sqlite3_column_text(stmt, 4);

        if (aid) strncpy(list[n].account_id, aid, sizeof(list[n].account_id) - 1);
        if (name) strncpy(list[n].holder_name, name, sizeof(list[n].holder_name) - 1);
        list[n].balance_paise = sqlite3_column_int64(stmt, 2);
        if (c_at) strncpy(list[n].created_at, c_at, sizeof(list[n].created_at) - 1);
        if (u_at) strncpy(list[n].updated_at, u_at, sizeof(list[n].updated_at) - 1);
        n++;
    }

    sqlite3_finalize(stmt);
    *out = list;
    *count = n;
    return 0;
}

int db_create_account(sqlite3 *db, const char *acc_id, const char *holder_name, int64_t balance_paise, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !acc_id || !holder_name || balance_paise < 0) {
        if (err_msg) snprintf(err_msg, err_size, "Invalid account parameters");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);

    const char *sql = "INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES (?, ?, ?);";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Prepare failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_text(stmt, 1, acc_id, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, holder_name, -1, SQLITE_STATIC);
    sqlite3_bind_int64(stmt, 3, balance_paise);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        if (err_msg) snprintf(err_msg, err_size, "Insert failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    // Log transaction
    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "NEW");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'CREATE', NULL, ?, ?, ?, 'SUCCESS', 'Account created');";
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt, 3, balance_paise);
        sqlite3_bind_text(stmt, 4, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_update_account(sqlite3 *db, const char *acc_id, const char *holder_name, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !acc_id || !holder_name) {
        if (err_msg) snprintf(err_msg, err_size, "Invalid update parameters");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);
    const char *sql = "UPDATE accounts SET holder_name = ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Prepare error: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_text(stmt, 1, holder_name, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE || sqlite3_changes(db) == 0) {
        if (err_msg) snprintf(err_msg, err_size, "Account not found or unchanged");
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }

    // Log transaction
    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "UPD");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'UPDATE', ?, NULL, 0, ?, 'SUCCESS', 'Holder name updated');";
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 3, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_delete_account(sqlite3 *db, const char *acc_id, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !acc_id) {
        if (err_msg) snprintf(err_msg, err_size, "Invalid delete parameters");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);

    // Verify account exists
    account_t acc;
    if (db_get_account(db, acc_id, &acc) != 0) {
        if (err_msg) snprintf(err_msg, err_size, "Account %s does not exist", acc_id);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }

    const char *sql = "DELETE FROM accounts WHERE account_id = ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Prepare error: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_text(stmt, 1, acc_id, -1, SQLITE_STATIC);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        if (err_msg) snprintf(err_msg, err_size, "Delete failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    // Log transaction
    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "DEL");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'DELETE', ?, NULL, 0, ?, 'SUCCESS', 'Account deleted');";
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 3, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_deposit(sqlite3 *db, const char *acc_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !acc_id || amount_paise <= 0) {
        if (err_msg) snprintf(err_msg, err_size, "Deposit amount must be positive");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);

    account_t acc;
    if (db_get_account(db, acc_id, &acc) != 0) {
        if (err_msg) snprintf(err_msg, err_size, "Account %s not found", acc_id);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }

    const char *sql = "UPDATE accounts SET balance_paise = balance_paise + ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Prepare error: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_int64(stmt, 1, amount_paise);
    sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        if (err_msg) snprintf(err_msg, err_size, "Update balance failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "DEP");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'DEPOSIT', NULL, ?, ?, ?, 'SUCCESS', 'Deposit transaction');";
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt, 3, amount_paise);
        sqlite3_bind_text(stmt, 4, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_withdraw(sqlite3 *db, const char *acc_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !acc_id || amount_paise <= 0) {
        if (err_msg) snprintf(err_msg, err_size, "Withdrawal amount must be positive");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);

    account_t acc;
    if (db_get_account(db, acc_id, &acc) != 0) {
        if (err_msg) snprintf(err_msg, err_size, "Account %s not found", acc_id);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }

    if (acc.balance_paise < amount_paise) {
        if (err_msg) snprintf(err_msg, err_size, "Insufficient funds: balance is ₹%.2f, withdrawal requested ₹%.2f", acc.balance_paise / 100.0, amount_paise / 100.0);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -3; // Insufficient funds
    }

    const char *sql = "UPDATE accounts SET balance_paise = balance_paise - ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Prepare error: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    sqlite3_bind_int64(stmt, 1, amount_paise);
    sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
        if (err_msg) snprintf(err_msg, err_size, "Update balance failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }

    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "WTH");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'WITHDRAW', ?, NULL, ?, ?, 'SUCCESS', 'Withdrawal transaction');";
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, acc_id, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt, 3, amount_paise);
        sqlite3_bind_text(stmt, 4, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_transfer(sqlite3 *db, const char *src_id, const char *dst_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size) {
    if (!db || !src_id || !dst_id || amount_paise <= 0) {
        if (err_msg) snprintf(err_msg, err_size, "Invalid transfer parameters");
        return -1;
    }

    if (strcmp(src_id, dst_id) == 0) {
        if (err_msg) snprintf(err_msg, err_size, "Source and destination accounts must be different");
        return -1;
    }

    sqlite3_exec(db, "BEGIN IMMEDIATE;", NULL, NULL, NULL);

    account_t src, dst;
    if (db_get_account(db, src_id, &src) != 0) {
        if (err_msg) snprintf(err_msg, err_size, "Source account %s not found", src_id);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }
    if (db_get_account(db, dst_id, &dst) != 0) {
        if (err_msg) snprintf(err_msg, err_size, "Destination account %s not found", dst_id);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -2;
    }

    if (src.balance_paise < amount_paise) {
        if (err_msg) snprintf(err_msg, err_size, "Insufficient balance in source account %s: available ₹%.2f, requested ₹%.2f", src_id, src.balance_paise / 100.0, amount_paise / 100.0);
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -3;
    }

    // Debit source
    const char *debit_sql = "UPDATE accounts SET balance_paise = balance_paise - ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?;";
    sqlite3_stmt *stmt1 = NULL;
    if (sqlite3_prepare_v2(db, debit_sql, -1, &stmt1, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Debit prepare failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }
    sqlite3_bind_int64(stmt1, 1, amount_paise);
    sqlite3_bind_text(stmt1, 2, src_id, -1, SQLITE_STATIC);
    if (sqlite3_step(stmt1) != SQLITE_DONE) {
        sqlite3_finalize(stmt1);
        if (err_msg) snprintf(err_msg, err_size, "Debit execution failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }
    sqlite3_finalize(stmt1);

    // Credit destination
    const char *credit_sql = "UPDATE accounts SET balance_paise = balance_paise + ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?;";
    sqlite3_stmt *stmt2 = NULL;
    if (sqlite3_prepare_v2(db, credit_sql, -1, &stmt2, NULL) != SQLITE_OK) {
        if (err_msg) snprintf(err_msg, err_size, "Credit prepare failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }
    sqlite3_bind_int64(stmt2, 1, amount_paise);
    sqlite3_bind_text(stmt2, 2, dst_id, -1, SQLITE_STATIC);
    if (sqlite3_step(stmt2) != SQLITE_DONE) {
        sqlite3_finalize(stmt2);
        if (err_msg) snprintf(err_msg, err_size, "Credit execution failed: %s", sqlite3_errmsg(db));
        sqlite3_exec(db, "ROLLBACK;", NULL, NULL, NULL);
        return -1;
    }
    sqlite3_finalize(stmt2);

    // Record atomic transfer transaction
    char txn_id[64];
    generate_txn_id(txn_id, sizeof(txn_id), "TRF");
    const char *log_sql = "INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details) VALUES (?, 'TRANSFER', ?, ?, ?, ?, 'SUCCESS', 'Inter-account transfer');";
    sqlite3_stmt *stmt3 = NULL;
    if (sqlite3_prepare_v2(db, log_sql, -1, &stmt3, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt3, 1, txn_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt3, 2, src_id, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt3, 3, dst_id, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt3, 4, amount_paise);
        sqlite3_bind_text(stmt3, 5, op_id ? op_id : "", -1, SQLITE_STATIC);
        sqlite3_step(stmt3);
        sqlite3_finalize(stmt3);
    }

    sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
    return 0;
}

int db_list_transactions(sqlite3 *db, transaction_t **out, int *count, int limit) {
    if (!db || !out || !count) return -1;
    *out = NULL;
    *count = 0;
    if (limit <= 0) limit = 100;

    const char *sql = "SELECT transaction_id, transaction_type, COALESCE(source_account, ''), COALESCE(destination_account, ''), amount_paise, COALESCE(operation_id, ''), status, COALESCE(details, ''), created_at FROM transactions ORDER BY created_at DESC, rowid DESC LIMIT ?;";
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return -1;
    }

    sqlite3_bind_int(stmt, 1, limit);

    int capacity = 32;
    transaction_t *list = malloc(sizeof(transaction_t) * capacity);
    if (!list) {
        sqlite3_finalize(stmt);
        return -1;
    }

    int n = 0;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        if (n >= capacity) {
            capacity *= 2;
            transaction_t *new_list = realloc(list, sizeof(transaction_t) * capacity);
            if (!new_list) {
                free(list);
                sqlite3_finalize(stmt);
                return -1;
            }
            list = new_list;
        }
        memset(&list[n], 0, sizeof(transaction_t));
        const char *tid = (const char*)sqlite3_column_text(stmt, 0);
        const char *ttype = (const char*)sqlite3_column_text(stmt, 1);
        const char *src = (const char*)sqlite3_column_text(stmt, 2);
        const char *dst = (const char*)sqlite3_column_text(stmt, 3);
        int64_t amt = sqlite3_column_int64(stmt, 4);
        const char *op = (const char*)sqlite3_column_text(stmt, 5);
        const char *stat = (const char*)sqlite3_column_text(stmt, 6);
        const char *det = (const char*)sqlite3_column_text(stmt, 7);
        const char *cat = (const char*)sqlite3_column_text(stmt, 8);

        if (tid) strncpy(list[n].transaction_id, tid, sizeof(list[n].transaction_id) - 1);
        if (ttype) strncpy(list[n].transaction_type, ttype, sizeof(list[n].transaction_type) - 1);
        if (src) strncpy(list[n].source_account, src, sizeof(list[n].source_account) - 1);
        if (dst) strncpy(list[n].destination_account, dst, sizeof(list[n].destination_account) - 1);
        list[n].amount_paise = amt;
        if (op) strncpy(list[n].operation_id, op, sizeof(list[n].operation_id) - 1);
        if (stat) strncpy(list[n].status, stat, sizeof(list[n].status) - 1);
        if (det) strncpy(list[n].details, det, sizeof(list[n].details) - 1);
        if (cat) strncpy(list[n].created_at, cat, sizeof(list[n].created_at) - 1);
        n++;
    }

    sqlite3_finalize(stmt);
    *out = list;
    *count = n;
    return 0;
}
