# SyncDB Lab — 5 to 10 Minute Live Demonstration Script
**Project Group:** G-15  
**Team Members:**  
- B. Thrinadh (Roll No: 2520030529)  
- Madhan (Roll No: 2520030263)  
- M. Nihal (Roll No: 2520030124)  
**Project:** Readers–Writers Concurrent Database Simulator  
**Intended Audience:** Faculty Evaluators, External Examiners, Operating Systems Project Review Panel  

---

## Demonstration Checklist & Setup (2 Minutes Before Demo)
1. Open Ubuntu Terminal:
   ```bash
   cd /path/to/SyncDB_Lab
   ./scripts/start.sh
   ```
2. Open Chrome or Firefox browser to:
   ```
   http://localhost:5173
   ```
3. Verify that the top navigation bar displays:
   - **Engine Status:** `CONNECTED` (Green badge)
   - **Database Status:** `READY (WAL)`
   - **Active Policy:** `READER_PREF`

---

## Presentation Timeline (Total: 8–10 Minutes)

| Time | Section | Presenter | Key Focus |
|---|---|---|---|
| **0:00 - 1:30** | Introduction & Problem Overview | Member 1 (B. Thrinadh) | Context, Group details, Classical Invariants |
| **1:30 - 3:00** | Architecture & C POSIX Core | Member 2 (Madhan) | 4-layer architecture, pthread primitives, SQLite WAL |
| **3:00 - 6:00** | Live Simulation & Algorithm Comparison | Member 3 (M. Nihal) | Reader Pref vs Writer Pref vs Fair FIFO |
| **6:00 - 7:30** | Database Integrity & Visualizer | Member 1 & 2 | Atomic transfers, Indian currency, Gantt timeline |
| **7:30 - 9:00** | Automated Test Suite & Analytics | Member 3 | 67 C assertions, 9 pytest tests, CSV export |
| **9:00 - 10:00**| Conclusion & Faculty Q&A | All Members | Take questions from Viva Guide |

---

## Detailed Step-by-Step Script

### Step 1: Introduction & Objective (1.5 Minutes)
**Speaker: B. Thrinadh (2520030529)**
> "Respected evaluators, good morning. We are Group G-15: myself B. Thrinadh, and my teammates Madhan and M. Nihal. Today, we are presenting our Operating Systems capstone project: **SyncDB Lab** — a real-time Readers–Writers Concurrent Database Simulator.
>
> In operating systems, the Readers–Writers problem is the foundational challenge of concurrency control: multiple readers can safely read simultaneously, but a writer requires strictly exclusive access.
>
> Many student projects merely animate fictional JavaScript threads with `setTimeout`. In contrast, **SyncDB Lab runs genuine C11 POSIX threads (`pthread`)** utilizing low-level mutexes, condition variables, and real SQLite database transactions in WAL mode on Ubuntu Linux. The React frontend visualizes real OS-level thread states streamed over WebSockets."

---

### Step 2: System Architecture Walkthrough (1.5 Minutes)
**Speaker: Madhan (2520030263)**
> *(Navigate to the **Architecture / Algorithm Explainer** page in the UI)*
>
> "Our application follows a strict 4-layer architecture:
> 1. **Core C Multithreaded Engine:** Written in C11. It spawns real OS worker threads, manages POSIX mutexes and condition variables, executes SQL queries through SQLite3's C API, and calculates high-resolution timings using `clock_gettime(CLOCK_MONOTONIC)`.
> 2. **Shared Database Layer:** Real SQLite3 database configured in Write-Ahead Logging (`WAL`) mode with integer-based Indian currency (paise) to prevent precision loss.
> 3. **FastAPI Subprocess Orchestrator:** Manages the C engine lifecycle as an isolated subprocess, streaming structured JSON Lines events bidirectionally over `stdin` and `stdout`.
> 4. **React & Tailwind Dashboard:** Connected via WebSockets to render live thread states, Gantt execution timelines, and analytical latency charts."

---

### Step 3: Verification of Automated Test Suite (1 Minute)
**Speaker: M. Nihal (2520030124)**
> *(Switch to the terminal to show evaluator our test suite)*
>
> "Before running interactive workloads, we demonstrate that our C synchronization engine and FastAPI backend pass rigorous automated tests:
> ```bash
> ./scripts/test_all.sh
> ```
> As you can see on the screen:
> - **67 out of 67 C engine correctness assertions PASS**, including zero invariant violations under high contention.
> - **9 out of 9 FastAPI backend integration tests PASS**.
> - The TypeScript React production bundle builds cleanly with zero errors."

---

### Step 4: Live Demonstration of Algorithms (3 Minutes)
**Speaker: M. Nihal (2520030124)**
> *(Navigate to **Simulation Control** page)*

#### Experiment 1: Demonstrating Writer Starvation (Reader Preference)
1. Select **Algorithm:** `Reader Preference`.
2. Select **Preset:** `Preset B — Heavy Readers (90% Reads, 10% Writes)`.
3. Set **Thread Count:** `16 threads`, **Duration:** `5 seconds`.
4. Click **Start Simulation**.
5. Switch to **Live Visualizer**.
> *"Observe the Live Visualizer. Multiple green bars appear simultaneously in the Active Resource slot — these are concurrent readers accessing SQLite at the same time. Notice the orange writer threads in the Queued column: because new readers keep arriving, `read_count` never drops to 0. The writer is starved! Look at the metrics: Reader average latency is under 2 ms, while writer wait time spikes significantly."*

#### Experiment 2: Resolving Writer Starvation (Writer Preference)
1. Navigate back to **Simulation Control**.
2. Select **Algorithm:** `Writer Preference`.
3. Keep **Preset B** active.
4. Click **Start Simulation**.
> *"Now observe the difference. As soon as a writer queues up, incoming readers are immediately blocked at the entry barrier. The moment the currently active readers exit, the writer gets immediate exclusive access (a single red block in the Active Resource slot). Writer wait time drops drastically."*

#### Experiment 3: Starvation-Resistant Fair Scheduling (FIFO + Reader Batching)
1. Select **Algorithm:** `Fair Scheduling`.
2. Select **Preset:** `Preset E — Starvation Stress Test`.
3. Click **Start Simulation**.
> *"Here, our Fair Scheduler assigns ticket numbers to arriving threads. No writer is bypassed by newer readers, and no reader is starved by writers. Notice our **Adjacent Reader Batching** optimization: when a reader reaches the head of the line, consecutive readers behind it are admitted as a batch to maximize database throughput without compromising fairness."*

---

### Step 5: Database Manager & ACID Invariant Verification (1.5 Minutes)
**Speaker: B. Thrinadh (2520030529)**
> *(Navigate to **Database Manager** page)*
>
> "Let us inspect the live database:
> - Here are the 10 seeded accounts displaying balances formatted in Indian Rupees (₹).
> - Every balance is stored as integer paise. For example, ₹50,000.75 is stored as `5000075`.
> - Click **Perform Transfer**: Transfer ₹5,000 from Account 1 to Account 2.
> - Notice that the total bank balance across all accounts remains strictly constant. The C engine executes this inside an atomic SQL transaction guarded by our writer lock, guaranteeing ACID isolation."

---

### Step 6: Analytics, Gantt Timeline & Report Export (1 Minute)
**Speaker: Madhan (2520030263)**
> *(Navigate to **Analytics & Charts** page)*
>
> "In the Analytics tab, the system plots empirical comparative charts:
> - **Throughput Chart:** Compares operations per second across Reader Preference, Writer Preference, and Fair Scheduling.
> - **Wait Time Distribution Histogram:** Shows the latency distribution in nanoseconds/milliseconds.
> - **Gantt Chart:** Graphically proves the fundamental invariant: **ActiveReaders > 0 implies ActiveWriters == 0**, and **ActiveWriters <= 1** at every millisecond of execution.
> - We can click **Export CSV Report** to download the complete experiment data for external statistical analysis."

---

### Step 7: Conclusion & Handover for Faculty Q&A (30 Seconds)
**Speaker: B. Thrinadh (2520030529)**
> "To conclude, SyncDB Lab demonstrates:
> 1. Real POSIX multithreading with genuine OS-level concurrency control.
> 2. Zero invariant violations and zero deadlocks under all stress conditions.
> 3. Practical proof of the starvation trade-offs in Courtois' classical algorithms versus modern fair queuing.
>
> Thank you, professors. We are now ready to answer any theoretical or implementation questions from our Viva Voce Guide."

---

## Quick Reference for Common Faculty "Curveball" Questions
- **"Where are the pthreads created?"**  
  $\rightarrow$ In `engine/src/worker.c` inside `worker_pool_start()` using `pthread_create(&pool->threads[i], NULL, worker_thread_func, ...)`.
- **"Where is the Readers-Writers synchronization implemented?"**  
  $\rightarrow$ In `engine/src/reader_preference.c`, `writer_preference.c`, and `fair_scheduler.c`.
- **"Why didn't you just use Python threading?"**  
  $\rightarrow$ Python has the Global Interpreter Lock (GIL) which serializes bytecode execution on a single core. To demonstrate genuine multicore OS thread concurrency and POSIX primitives, the engine must be in C.
- **"How did you prevent memory leaks?"**  
  $\rightarrow$ Every allocated structure (`cJSON`, `sqlite3_stmt`, thread pools) has matching deallocation functions (`cJSON_Delete`, `sqlite3_finalize`, `free`), verified with clean Valgrind-compatible patterns.

---

*SyncDB Lab — Academic Capstone Live Demonstration Guide | Group G-15*
