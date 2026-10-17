-- SyncDB Lab - Seed Data
-- Initial accounts with balances specified in Indian paise

DELETE FROM transactions;
DELETE FROM accounts;

-- ₹10,000 = 1,000,000 paise
INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES ('ACC001', 'Customer A', 1000000);
-- ₹25,000 = 2,500,000 paise
INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES ('ACC002', 'Customer B', 2500000);
-- ₹15,000 = 1,500,000 paise
INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES ('ACC003', 'Customer C', 1500000);
-- ₹30,000 = 3,000,000 paise
INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES ('ACC004', 'Customer D', 3000000);
-- ₹45,000 = 4,500,000 paise
INSERT INTO accounts (account_id, holder_name, balance_paise) VALUES ('ACC005', 'Customer E', 4500000);

-- Initial Transaction Logs
INSERT INTO transactions (transaction_id, transaction_type, source_account, destination_account, amount_paise, operation_id, status, details)
VALUES 
    ('TXN-INIT-001', 'DEPOSIT', NULL, 'ACC001', 1000000, 'OP-INIT-1', 'SUCCESS', 'Initial seed funding'),
    ('TXN-INIT-002', 'DEPOSIT', NULL, 'ACC002', 2500000, 'OP-INIT-2', 'SUCCESS', 'Initial seed funding'),
    ('TXN-INIT-003', 'DEPOSIT', NULL, 'ACC003', 1500000, 'OP-INIT-3', 'SUCCESS', 'Initial seed funding'),
    ('TXN-INIT-004', 'DEPOSIT', NULL, 'ACC004', 3000000, 'OP-INIT-4', 'SUCCESS', 'Initial seed funding'),
    ('TXN-INIT-005', 'DEPOSIT', NULL, 'ACC005', 4500000, 'OP-INIT-5', 'SUCCESS', 'Initial seed funding');
