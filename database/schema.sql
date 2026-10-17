-- SyncDB Lab - SQLite Database Schema
-- Group G-15: Readers-Writers Concurrent Database Simulator

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Drop existing tables if recreating
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;

-- Accounts Table
-- Stores balance in Indian paise (1 INR = 100 paise) to avoid floating point inaccuracies
CREATE TABLE accounts (
    account_id VARCHAR(32) PRIMARY KEY,
    holder_name VARCHAR(128) NOT NULL,
    balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table
-- Records every financial operation performed by writer threads
CREATE TABLE transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    transaction_type VARCHAR(32) NOT NULL, -- 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'CREATE', 'UPDATE', 'DELETE'
    source_account VARCHAR(32) REFERENCES accounts(account_id) ON DELETE SET NULL,
    destination_account VARCHAR(32) REFERENCES accounts(account_id) ON DELETE SET NULL,
    amount_paise INTEGER NOT NULL DEFAULT 0,
    operation_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'ROLLED_BACK'
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_holder ON accounts(holder_name);
CREATE INDEX IF NOT EXISTS idx_transactions_src ON transactions(source_account);
CREATE INDEX IF NOT EXISTS idx_transactions_dest ON transactions(destination_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
