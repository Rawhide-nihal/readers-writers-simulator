#ifndef SYNCDB_DATABASE_H
#define SYNCDB_DATABASE_H

#include <sqlite3.h>
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef struct {
    char account_id[32];
    char holder_name[128];
    int64_t balance_paise;
    char created_at[32];
    char updated_at[32];
} account_t;

typedef struct {
    char transaction_id[64];
    char transaction_type[32];
    char source_account[32];
    char destination_account[32];
    int64_t amount_paise;
    char operation_id[64];
    char status[32];
    char details[256];
    char created_at[32];
} transaction_t;

// Connection & Setup
int db_init(const char *db_path);
int db_reset_from_scripts(const char *db_path, const char *schema_file, const char *seed_file);
int db_open_conn(const char *db_path, sqlite3 **db);
void db_close_conn(sqlite3 *db);

// Reads (Executed under Shared Reader Lock)
int db_get_account(sqlite3 *db, const char *acc_id, account_t *out);
int db_list_accounts(sqlite3 *db, account_t **out, int *count);
int db_list_transactions(sqlite3 *db, transaction_t **out, int *count, int limit);

// Writes (Executed under Exclusive Writer Lock)
int db_create_account(sqlite3 *db, const char *acc_id, const char *holder_name, int64_t balance_paise, const char *op_id, char *err_msg, size_t err_size);
int db_update_account(sqlite3 *db, const char *acc_id, const char *holder_name, const char *op_id, char *err_msg, size_t err_size);
int db_delete_account(sqlite3 *db, const char *acc_id, const char *op_id, char *err_msg, size_t err_size);
int db_deposit(sqlite3 *db, const char *acc_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size);
int db_withdraw(sqlite3 *db, const char *acc_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size);
int db_transfer(sqlite3 *db, const char *src_id, const char *dst_id, int64_t amount_paise, const char *op_id, char *err_msg, size_t err_size);

#endif // SYNCDB_DATABASE_H
