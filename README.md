# SyncDB Lab — Readers–Writers Concurrent Database Simulator

[![OS: Ubuntu Linux](https://img.shields.io/badge/OS-Ubuntu%2022.04%20%7C%2024.04%20LTS-E95420?logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![Core Engine: C11 POSIX Threads](https://img.shields.io/badge/Core%20Engine-C11%20%7C%20pthread-00599C?logo=c&logoColor=white)](https://en.wikipedia.org/wiki/C11_(C_standard_revision))
[![Database: SQLite3 WAL](https://img.shields.io/badge/Database-SQLite3%20WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Backend: FastAPI AsyncIO](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Frontend: React 18 TypeScript](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Tailwind-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tests: 67 C Tests + 9 Pytest](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen)](#testing--verification)

> **Full-Stack Operating Systems Capstone Project**  
> **Academic Project Group:** G-15  
> **Team Members:**  
> - **B. Thrinadh** (Roll No: 2520030529)  
> - **Madhan** (Roll No: 2520030263)  
> - **M. Nihal** (Roll No: 2520030124)  

---

## 1. Executive Summary

**SyncDB Lab** is a full-stack, production-grade Operating Systems demonstration platform engineered to solve and visualize the classical **Readers–Writers Concurrency Problem**.

Unlike conventional instructional web tools that use simulated JavaScript timers (`setTimeout`), **SyncDB Lab executes genuine C11 POSIX threads (`pthread`)** utilizing low-level mutexes, condition variables, and an ACID-compliant **SQLite3** database operating in **Write-Ahead Logging (WAL)** mode.

A high-performance **Python FastAPI** backend orchestrates the C engine as an isolated subprocess, streaming real-time thread state transitions over full-duplex WebSockets to a responsive **React + TypeScript + Tailwind CSS** dashboard.

### Core Mathematical Invariants Enforced
At every instant $t$, the system mathematically verifies:
1. **Concurrent Read Safety:** $\text{ActiveReaders}(t) > 0 \implies \text{ActiveWriters}(t) = 0$
2. **Writer Exclusivity:** $\text{ActiveWriters}(t) \le 1$
3. **Mutual Exclusion:** $\neg (\text{ActiveReaders}(t) > 0 \land \text{ActiveWriters}(t) > 0)$

---

## 2. Key Features

- **Three Classical Synchronization Algorithms:**
  1. *Reader Preference (Courtois First Solution):* Maximum read concurrency; demonstrably exhibits writer starvation under sustained read traffic.
  2. *Writer Preference (Courtois Second Solution):* Pending writers block incoming readers; demonstrably exhibits reader starvation under heavy write workloads.
  3. *Fair FIFO Scheduling (Ticket Queue + Adjacent Reader Batching):* Zero starvation for both readers and writers with bounded wait times.
- **Real SQLite Database Integration:** 
  - Real account queries, deposits, withdrawals, and atomic multi-account transfers.
  - Balances stored in 64-bit integer paise (1 INR = 100 paise) to prevent floating-point precision loss.
- **High-Resolution Timing:** Nanosecond-accurate execution and wait times tracked via POSIX `clock_gettime(CLOCK_MONOTONIC)`.
- **Real-Time Visualization:**
  - Dynamic Gantt execution timelines showing thread synchronization gates.
  - Visual resource slot representing concurrent read vs. exclusive write states.
  - Live log stream with search, filtering, and pause controls.
- **7 Preconfigured Workload Presets (A through G):**
  - Balanced (50/50), Heavy Readers (90/10), Heavy Writers (10/90), High Contention, Starvation Stress, Burst Traffic, Long Operations.
- **Comprehensive Analytics & Export:**
  - Latency percentiles ($p_{50}$, $p_{90}$, $p_{99}$), wait time histograms, throughput comparisons, and CSV export.

---

## 3. System Architecture

```
+-------------------------------------------------------------------------+
|                         Layer 1: React Frontend                         |
|    (React 18, TypeScript 5, Vite, Tailwind CSS, Lucide, Recharts)       |
|    Dashboard | Visualizer | Control | DB Manager | Analytics | Logs      |
+------------------------------------+------------------------------------+
                                     | HTTP REST & WebSockets (ws://)
                                     v
+-------------------------------------------------------------------------+
|                         Layer 2: FastAPI Backend                        |
|        (Python 3.10+, Uvicorn, AsyncIO Subprocess Bridge, Pytest)        |
|    Command Validation | Subprocess Supervision | WebSocket Broadcast    |
+------------------------------------+------------------------------------+
                                     | Non-blocking JSON Lines (stdin / stdout)
                                     v
+-------------------------------------------------------------------------+
|                     Layer 3: Real C Multithreading Engine               |
|      (C11, POSIX Threads, Mutexes, Condition Variables, cJSON)         |
|   Worker Thread Pool | Reader/Writer/Fair Schedulers | Metrics Collector|
+------------------------------------+------------------------------------+
                                     | SQLite C API (WAL Mode)
                                     v
+-------------------------------------------------------------------------+
|                         Layer 4: SQLite Database                        |
|      (ACID Transactions, Integer Paise Balances, Transaction History)   |
+-------------------------------------------------------------------------+
```

---

## 4. Repository Structure

```
.
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── api/routes.py     # REST endpoints for simulation & DB
│   │   ├── engine_bridge/    # Subprocess IPC bridge (stdin/stdout JSON Lines)
│   │   ├── websocket/        # WebSocket client connection manager
│   │   ├── storage/          # Experiment history and metrics persister
│   │   ├── config.py         # App configuration settings
│   │   └── main.py           # Application entrypoint
│   ├── tests/                # Pytest integration test suite
│   └── requirements.txt      # Python dependencies
├── database/                 # SQLite database definitions
│   ├── schema.sql            # Accounts and transactions schema (WAL mode)
│   └── seed.sql              # Seed accounts with Indian Rupee balances
├── docs/                     # Project Documentation
│   ├── ARCHITECTURE.md       # Full architecture & IPC specifications
│   ├── ALGORITHMS.md         # Detailed mathematical algorithm breakdown
│   ├── USER_GUIDE.md         # Operational step-by-step user guide
│   ├── TESTING.md            # Test plans, test cases & validation logs
│   ├── VIVA_GUIDE.md         # 30 Comprehensive Viva Voce questions & answers
│   └── DEMO_SCRIPT.md        # 5–10 minute live presentation script
├── engine/                   # Core C11 POSIX Concurrency Engine
│   ├── include/              # Header files (engine, scheduler, database, metrics)
│   ├── src/                  # Implementation (reader_pref, writer_pref, fair_sched)
│   ├── CMakeLists.txt        # CMake build configuration
│   └── cJSON.c / cJSON.h     # High-speed JSON serialization library
├── frontend/                 # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/       # UI components (Visualizer, Gantt, Cards, Modals)
│   │   ├── pages/            # 8 Application pages (Dashboard, Live, Analytics, etc.)
│   │   ├── services/         # API and WebSocket client services
│   │   └── types/            # TypeScript data model contracts
│   ├── package.json          # Frontend dependencies
│   └── vite.config.ts        # Vite configuration
├── scripts/                  # Automated Ubuntu bash scripts
│   ├── setup_ubuntu.sh       # Installs compiler, Python, Node, SQLite
│   ├── build_engine.sh       # Compiles C engine with CMake
│   ├── start.sh              # Launches backend and frontend concurrently
│   ├── test_all.sh           # Runs C test suite and backend pytest suite
│   └── clean.sh              # Cleans build artifacts and caches
├── tests/                    # C Engine unit & concurrency tests
│   └── engine/test_correctness.c # 67 automated assertions
└── README.md                 # Project Master README
```

---

## 5. Prerequisites & Dependencies

Target Operating System: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (Native or WSL2 x86_64).

Required system packages:
- `build-essential`, `cmake`, `gcc`
- `sqlite3`, `libsqlite3-dev`
- `python3`, `python3-pip`, `python3-venv`
- `nodejs` (v18+ or v20+), `npm`

---

## 6. Quick Start Guide

### Step 1: Install System Prerequisites
Run the automated Ubuntu setup script:
```bash
chmod +x scripts/*.sh
./scripts/setup_ubuntu.sh
```

### Step 2: Build the C Synchronization Engine
Compile the C11 POSIX engine and test binaries:
```bash
./scripts/build_engine.sh
```
*Binary output: `engine/build/syncdb_engine`*

### Step 3: Launch the Full Application
Start both the FastAPI backend (`http://localhost:8000`) and the React frontend (`http://localhost:5173`):
```bash
./scripts/start.sh
```
Open your browser and navigate to:  
👉 **`http://localhost:5173`**

*(Press `Ctrl + C` in the terminal to stop all running processes cleanly).*

---

## 7. Testing & Verification

Run the unified test runner to execute the C test suite and Python pytest integration suite:
```bash
./scripts/test_all.sh
```

### Verification Results
1. **C POSIX Engine Unit & Concurrency Suite (`test_correctness`):**
   - **67 assertions passed, 0 failed, 0 invariant violations.**
   - Tests verified:
     - Mutex and condition variable initialization
     - SQLite WAL database read/write/transfer isolation
     - Courtois First Readers-Writers logic
     - Courtois Second Readers-Writers logic
     - Starvation-resistant FIFO ticketing with reader batching
     - Multi-threaded stress test with concurrent threads
2. **FastAPI Backend Suite (`pytest`):**
   - **9 integration tests passed, 0 failed.**
   - Tests verified: Healthcheck, account listing, account retrieval, C engine process supervision, simulation start/stop, invalid preset rejection, database reset.
3. **Frontend Production Build (`vite build`):**
   - **Compiled cleanly in TypeScript with zero lint/type errors.**

---

## 8. Documentation Index

Comprehensive academic documentation is available in the [`docs/`](./docs) directory:
- [**Architecture Guide (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — 4-layer design, IPC protocol specification, and sequence diagrams.
- [**Algorithms Specification (`docs/ALGORITHMS.md`)**](./docs/ALGORITHMS.md) — Mathematical proofs, lock orders, pseudocode, and starvation analysis.
- [**User Guide (`docs/USER_GUIDE.md`)**](./docs/USER_GUIDE.md) — Visual walkthrough of all 8 application pages and preset configurations.
- [**Testing Documentation (`docs/TESTING.md`)**](./docs/TESTING.md) — Detailed test cases, edge condition coverage, and actual execution logs.
- [**Viva Voce Guide (`docs/VIVA_GUIDE.md`)**](./docs/VIVA_GUIDE.md) — 30 exhaustive Q&As for oral examination covering OS theory, pthreads, and WAL concurrency.
- [**Demo Presentation Script (`docs/DEMO_SCRIPT.md`)**](./docs/DEMO_SCRIPT.md) — Timed 5–10 minute script structured for faculty evaluation.

---

## 9. Academic Integrity & Acknowledgements

This project was conceived and implemented as an academic capstone for the **Operating Systems Course**. All multithreading synchronization, condition variable signaling, and POSIX lock coordination are natively implemented in C11 without external third-party scheduling libraries.

**Project Group G-15:**
- **B. Thrinadh** (2520030529)
- **Madhan** (2520030263)
- **M. Nihal** (2520030124)
