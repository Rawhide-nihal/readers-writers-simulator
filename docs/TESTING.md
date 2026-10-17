# SyncDB Lab — Automated Testing & Validation Report
## Full-Stack Operating Systems Project Verification
### Group G-15 | Readers–Writers Concurrent Database Simulator

---

## 1. Test Suite Summary

SyncDB Lab includes three distinct automated testing layers:
1. **C POSIX Engine Correctness Suite (`tests/engine/test_correctness.c`)**: 67 assertions validating synchronization invariants, thread contention, and SQLite ACID transactions.
2. **FastAPI Backend Integration Suite (`backend/tests/test_backend.py`)**: 9 integration tests covering REST APIs, engine subprocess communication, correlation, and error paths.
3. **Frontend TypeScript & Vite Production Build**: Verifies complete TypeScript type safety and bundler compilation.

Run the entire suite with one command:
```bash
./scripts/test_all.sh
```

---

## 2. C Engine Correctness & Concurrency Tests

Executable: `engine/build/test_correctness`

### Scenarios Tested
1. **Single Reader:** Verifies reader acquisition, counter increment, invariant assertion, and decrement to zero.
2. **Multiple Simultaneous Readers:** Verifies concurrent reader sharing where 3 readers simultaneously hold the critical section gate while active writers == 0.
3. **Single Writer Exclusivity:** Verifies that a writer acquires an exclusive lock, active writers is exactly 1, and active readers is 0.
4. **Contention under Reader Preference:** Launches mixed reader/writer threads, verifying zero invariant violations and clean joining.
5. **Contention under Writer Preference:** Launches mixed threads under condition-variable-based writer prioritization with zero violations.
6. **Contention under Fair FIFO Scheduling:** Launches mixed threads with FIFO turn ticket queue with zero violations.
7. **Cooperative Cancellation:** Verifies that stopping the scheduler safely broadcasts to waiting threads, preventing deadlocks.
8. **Database ACID Transactions & Atomic Transfers:**
   - Database reset from `schema.sql` and `seed.sql`.
   - Seed verification (ACC001 initial balance ₹10,000 = 1,000,000 paise).
   - Deposit ₹5,000 to ACC001 -> Balance becomes ₹15,000.
   - Withdrawal ₹3,000 from ACC001 -> Balance becomes ₹12,000.
   - Overdraft rejection: attempting to withdraw ₹9,999,999 is rejected; balance remains ₹12,000.
   - Atomic transfer: ACC001 transfers ₹2,000 to ACC002. Verifies debit and credit committed atomically.
   - Transaction audit table verification.

### Actual Output
```
==================================================
SyncDB Lab - C Correctness & Invariant Test Suite
Group G-15 (Readers-Writers Concurrency Project)
==================================================

--- Test: Single Reader ---
  [PASS] Single reader acquired lock
  [PASS] Active readers count is 1
  [PASS] Active writers count is 0
  [PASS] Invariants hold
  [PASS] Single reader released lock
  [PASS] Active readers count is 0 after release

--- Test: Multiple Simultaneous Readers ---
  [PASS] All 3 readers active simultaneously
  [PASS] Zero active writers while readers active
  [PASS] Invariants hold with 3 readers
  [PASS] Readers decremented to 0

--- Test: Single Writer Exclusivity ---
  [PASS] Writer acquired exclusive lock
  [PASS] Active writers count is exactly 1
  [PASS] Active readers count is 0
  [PASS] Invariants hold for writer
  [PASS] Writer released lock
  [PASS] Active writers count is 0

--- Test: Concurrent Threads (Reader Preference) ---
  [PASS] Thread executed and released successfully (x10)
  [PASS] Zero synchronization violations occurred
  [PASS] Clean cleanup of all threads

--- Test: Concurrent Threads (Writer Preference) ---
  [PASS] Thread executed and released successfully (x10)
  [PASS] Zero synchronization violations occurred
  [PASS] Clean cleanup of all threads

--- Test: Concurrent Threads (Fair FIFO Scheduling) ---
  [PASS] Thread executed and released successfully (x10)
  [PASS] Zero synchronization violations occurred
  [PASS] Clean cleanup of all threads

--- Test: Cancellation & Safe Stop ---
  [PASS] Scheduler registered stopped state

--- Test: Database Operations & Atomic Transfers ---
  [PASS] Database reset from schema.sql and seed.sql succeeded
  [PASS] Opened connection to test SQLite database
  [PASS] Found seeded account ACC001
  [PASS] ACC001 initial balance is ₹10,000
  [PASS] Deposit of ₹5,000 to ACC001 succeeded
  [PASS] ACC001 new balance is ₹15,000
  [PASS] Withdrawal of ₹3,000 from ACC001 succeeded
  [PASS] ACC001 new balance is ₹12,000
  [PASS] Overdraft correctly rejected with insufficient funds error
  [PASS] Balance unchanged after failed withdrawal
  [PASS] Atomic transfer of ₹2,000 from ACC001 to ACC002 committed
  [PASS] ACC001 correctly debited to ₹10,000
  [PASS] ACC002 correctly credited
  [PASS] Transaction log records created

==================================================
ALL TESTS COMPLETED: 67 / 67 PASSED
==================================================
```

---

## 3. Backend Integration Pytest Suite

Command:
```bash
./backend/venv/bin/pytest backend/tests -v
```

### Actual Output
```
============================= test session starts ==============================
collected 9 items

backend/tests/test_backend.py::test_health_check PASSED                  [ 11%]
backend/tests/test_backend.py::test_accounts_listing PASSED              [ 22%]
backend/tests/test_backend.py::test_single_account_read PASSED           [ 33%]
backend/tests/test_backend.py::test_invalid_account_read PASSED          [ 44%]
backend/tests/test_backend.py::test_manual_deposit_and_withdrawal PASSED [ 55%]
backend/tests/test_backend.py::test_insufficient_balance_withdrawal PASSED [ 66%]
backend/tests/test_backend.py::test_atomic_transfer PASSED               [ 77%]
backend/tests/test_backend.py::test_engine_status PASSED                 [ 88%]
backend/tests/test_backend.py::test_experiments_history PASSED           [100%]

============================== 9 passed in 14.91s ==============================
```

---

## 4. Frontend TypeScript & Production Build

Command:
```bash
cd frontend && npm run build
```

### Actual Output
```
> syncdb-lab-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2301 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.96 kB │ gzip:   0.55 kB
dist/assets/index-B5insus4.css   31.56 kB │ gzip:   6.00 kB
dist/assets/index-CTysZzwS.js   677.24 kB │ gzip: 184.96 kB
✓ built in 9.23s
```
Zero TypeScript or lint errors.
