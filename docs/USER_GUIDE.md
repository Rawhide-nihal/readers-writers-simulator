# SyncDB Lab — User & Operational Guide
## Readers–Writers Concurrent Database Simulator
### Group G-15 | Full-Stack Ubuntu OS Project

---

## 1. Quick Start Guide

### Prerequisites
- Operating System: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Ubuntu 26.04 via WSL2
- Packages: `build-essential`, `gcc`, `cmake`, `pkg-config`, `libsqlite3-dev`, `libcjson-dev`, `python3`, `python3-venv`, `python3-pip`, `nodejs`, `npm`

### One-Command Setup
To install all system dependencies, build the C engine, and configure Python and Node.js environments:
```bash
./scripts/setup_ubuntu.sh
```

### Launch the Full Application
```bash
./scripts/start.sh
```
This starts both the FastAPI backend on `http://127.0.0.1:8000` and the Vite React frontend on `http://localhost:5173`.
Open your browser and navigate to:
**`http://localhost:5173`**

---

## 2. Navigating the Application

The application features 8 dedicated pages accessible via the left sidebar:

### 1. Overview Dashboard (`/`)
- Displays real-time engine health, active policy badge, and simulation status.
- Eight live KPI metric cards (Active Readers, Active Writers, Waiting Queue, Violations, Completed Ops, Wait Times).
- **Central Shared Database Resource Monitor:** Visualizes the SQLite WAL resource gate with color-coded nodes (teal for shared readers, indigo for exclusive writer).
- Current SQLite accounts preview.

### 2. Database Manager (`/database`)
- Search and sort accounts by ID, Name, or Balance.
- **Deposit:** Adds funds to an account with an automatic `DEPOSIT` audit log.
- **Withdraw:** Withdraws funds, checking balance constraints (negative balances strictly rejected).
- **Transfer:** Atomically transfers funds between two accounts using `BEGIN IMMEDIATE` transactions.
- **Create / Edit / Delete:** Manage bank account entities safely.
- **Reset to Seed:** Restores the five default test accounts with seed funding.

### 3. Simulation Control Lab (`/simulation`)
- Choose between the 3 synchronization algorithms:
  1. *Reader Preference*
  2. *Writer Preference*
  3. *Fair FIFO Scheduling*
- Select one of the 7 curated experiment presets:
  - **Preset A: Multiple Readers** (5 Readers, 0 Writers) — Shared concurrency.
  - **Preset B: Writer Exclusivity** (0 Readers, 3 Writers) — Mutual exclusion.
  - **Preset C: Mixed Workload** (5 Readers, 2 Writers) — Contention.
  - **Preset D: Reader-Heavy** (12 Readers, 2 Writers) — Writer delay demonstration.
  - **Preset E: Writer-Heavy** (2 Readers, 6 Writers) — Reader delay demonstration.
  - **Preset F: Fair FIFO Scheduling** (6 Readers, 4 Writers) — Starvation-resistant.
  - **Preset G: Custom Configuration** — User-defined parameters.
- Fine-tune reader and writer workload durations (100–3000 ms) to observe concurrency in real-time.
- Configure arrival patterns: *Simultaneous Burst*, *Staggered Arrival*, or *Seeded Random*.
- Controls: **Start**, **Pause**, **Resume**, and **Stop** (clean cooperative cancellation).

### 4. Live Visualizer (`/visualizer`)
- Real-time Gantt execution timeline showing microsecond-precision monotonic phases: arrival, queuing, lock acquisition, critical section execution, and release.
- Interactive worker cards for each pthread worker thread.
- Filter by Role (Readers / Writers) and State (Active / Waiting / Completed).

### 5. Performance Analytics (`/analytics`)
- Recharts visualizations:
  - Observed waiting time breakdown (Readers vs Writers).
  - Outcome distribution (Completed Readers, Completed Writers, Failures).
  - Cross-policy comparative benchmark comparing Reader Preference, Writer Preference, and Fair FIFO across recorded runs.

### 6. Activity Logs (`/logs`)
- Live event stream showing all engine transitions.
- Search by Op ID, Account, Event name.
- Filter by role: Readers, Writers, or System.
- Toggle auto-scroll.
- Export audit logs to **CSV** or **JSON**.

### 7. Algorithm Explainer (`/explainer`)
- Comprehensive interactive lecture notes covering POSIX synchronization primitives, condition variables, race conditions, and SQLite WAL concurrency.
- Exact C pseudocode matching `engine/src/`.

### 8. About Project (`/about`)
- Group G-15 student credentials and roles.
- Architecture breakdown and capstone problem statement.
