import React, { useState } from 'react';
import { 
  BookOpen, 
  Code2, 
  Cpu, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Database 
} from 'lucide-react';

export const AlgorithmExplainerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALGORITHMS' | 'CONCEPTS' | 'SQLITE'>('ALGORITHMS');

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Operating Systems Theory &amp; Algorithm Explainer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            In-depth academic analysis of POSIX concurrency, synchronization primitives, and Readers–Writers solutions
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('ALGORITHMS')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'ALGORITHMS' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            3 Algorithms &amp; C Code
          </button>
          <button
            onClick={() => setActiveTab('CONCEPTS')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'CONCEPTS' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Core OS Primitives
          </button>
          <button
            onClick={() => setActiveTab('SQLITE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'SQLITE' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            SQLite WAL Concurrency
          </button>
        </div>
      </div>

      {/* Tab 1: Algorithms */}
      {activeTab === 'ALGORITHMS' && (
        <div className="space-y-6">
          {/* Algorithm 1: Reader Preference */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
                  ALGORITHM 1
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  First Readers–Writers Problem: Reader Preference (Courtois et al. 1971)
                </h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/60">
                Potential Writer Starvation
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Mechanism:</strong> Readers share the resource concurrently. A <code className="text-emerald-400 font-mono">read_count</code> variable tracks active readers protected by a mutex. The <em>first reader</em> to arrive locks the shared resource gate (<code className="text-emerald-400 font-mono">resource_lock</code>), blocking writers. Subsequent readers increment <code className="text-emerald-400 font-mono">read_count</code> and proceed without touching the resource lock. The <em>last reader</em> releases <code className="text-emerald-400 font-mono">resource_lock</code>.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto text-slate-300">
              <div className="text-slate-500 mb-2">// Implemented in engine/src/reader_preference.c</div>
              <pre className="text-indigo-300">{`// READER WORKER:
pthread_mutex_lock(&rp->readcount_lock);
rp->read_count++;
if (rp->read_count == 1) {
    pthread_mutex_lock(&rp->resource_lock); // First reader locks resource
}
pthread_mutex_unlock(&rp->readcount_lock);

// ---> Critical Section: Execute SQLite SELECT queries concurrently <---

pthread_mutex_lock(&rp->readcount_lock);
rp->read_count--;
if (rp->read_count == 0) {
    pthread_mutex_unlock(&rp->resource_lock); // Last reader unlocks resource
}
pthread_mutex_unlock(&rp->readcount_lock);

// WRITER WORKER:
pthread_mutex_lock(&rp->resource_lock); // Requires exclusive ownership
// ---> Critical Section: Execute SQLite UPDATE/INSERT <---
pthread_mutex_unlock(&rp->resource_lock);`}</pre>
            </div>
          </div>

          {/* Algorithm 2: Writer Preference */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800">
                  ALGORITHM 2
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Second Readers–Writers Problem: Writer Preference
                </h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/60">
                Potential Reader Delay
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Mechanism:</strong> Once a writer requests access, no newly arriving reader is allowed to acquire the lock. Active readers are permitted to complete. When the active reader count reaches zero, the waiting writer immediately claims exclusive access. Subsequent writers take precedence over waiting readers until all writers finish.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto text-slate-300">
              <div className="text-slate-500 mb-2">// Implemented in engine/src/writer_preference.c</div>
              <pre className="text-indigo-300">{`// READER ACQUISITION:
pthread_mutex_lock(&wp->lock);
wp->waiting_readers++;
while (wp->active_writers > 0 || wp->waiting_writers > 0) {
    pthread_cond_wait(&wp->can_read, &wp->lock); // Block if ANY writer is waiting!
}
wp->waiting_readers--;
wp->active_readers++;
pthread_mutex_unlock(&wp->lock);

// WRITER RELEASE:
pthread_mutex_lock(&wp->lock);
wp->active_writers--;
if (wp->waiting_writers > 0) {
    pthread_cond_signal(&wp->can_write); // Prioritize next waiting writer!
} else {
    pthread_cond_broadcast(&wp->can_read); // Wake readers only when writers queue is empty
}
pthread_mutex_unlock(&wp->lock);`}</pre>
            </div>
          </div>

          {/* Algorithm 3: Fair FIFO Scheduling */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-teal-400 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800">
                  ALGORITHM 3
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Third Readers–Writers Problem: Starvation-Resistant Fair FIFO Scheduling
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/60">
                No Starvation (FIFO Guaranteed)
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Mechanism:</strong> Requests receive sequential ticket numbers in arrival order and join an explicit linked queue. If a writer is queued ahead, subsequent readers cannot bypass it. When the critical section becomes free, the head request is evaluated: if a writer is at the head, it is admitted exclusively; if a reader is at the head, it and all consecutive adjacent readers are batched together and admitted simultaneously!
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto text-slate-300">
              <div className="text-slate-500 mb-2">// Implemented in engine/src/fair_scheduler.c</div>
              <pre className="text-indigo-300">{`// EVALUATING THE FAIR FIFO QUEUE:
if (fs->head->is_writer) {
    if (fs->active_readers == 0 && fs->active_writers == 0) {
        fair_waiter_t *w = dequeue(fs);
        fs->active_writers = 1;
        pthread_cond_signal(&w->cond); // Wake head writer
    }
} else {
    // Next in FIFO is reader: admit head and ALL consecutive adjacent readers!
    if (fs->active_writers == 0) {
        while (fs->head && !fs->head->is_writer) {
            fair_waiter_t *r = dequeue(fs);
            fs->active_readers++;
            pthread_cond_signal(&r->cond); // Batch admit reader group
        }
    }
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Core OS Concepts */}
      {activeTab === 'CONCEPTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Concurrency &amp; Threads</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              A <strong>thread</strong> is the smallest sequence of programmed instructions managed by the OS scheduler.
              In SyncDB Lab, every reader and writer is created with <code className="text-indigo-400 font-mono">pthread_create()</code>,
              operating independently within the same address space.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Critical Section &amp; Race Condition</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              A <strong>critical section</strong> is a code sequence accessing shared mutable resources (the SQLite database).
              A <strong>race condition</strong> occurs when output depends on non-deterministic thread scheduling without proper synchronization.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Mutex (Mutual Exclusion Lock)</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              A <strong>POSIX mutex</strong> (<code className="text-emerald-400 font-mono">pthread_mutex_t</code>) guarantees that only one thread holds ownership at a given time. If another thread attempts to lock it, the OS suspends the thread until the mutex is released.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Condition Variables</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              A <strong>condition variable</strong> (<code className="text-indigo-400 font-mono">pthread_cond_t</code>) allows threads to atomically release an associated mutex and sleep until another thread signals that a logical condition (e.g. active readers = 0) is satisfied.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Zap className="w-4 h-4 text-rose-400" />
              <span>Deadlock vs. Starvation</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Deadlock</strong> is a permanent circular wait where no thread makes progress.
              <strong>Starvation</strong> occurs when a thread is indefinitely bypassed by newly arriving requests despite resources being repeatedly released.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>The 8 Synchronization Invariants</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              The engine continuously asserts: (1) Active writers &le; 1, (2) If active writer &gt; 0, active readers == 0,
              (3) Non-negative counters, (4) No SQLite execution without access, (5) Strict matching lock/unlock cleanup,
              (6) No duplicate counting, (7) Atomic financial updates, (8) Well-defined experiment terminal state.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: SQLite WAL Mode */}
      {activeTab === 'SQLITE' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold">
            <Database className="w-5 h-5" />
            <span>SQLite WAL (Write-Ahead Logging) &amp; Thread-Level Concurrency</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            In standard rollback-journal mode, SQLite acquires exclusive file locks that prevent concurrent readers.
            In SyncDB Lab, we configure:
          </p>

          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 ml-2 font-mono">
            <li><code className="text-indigo-400">PRAGMA journal_mode = WAL;</code> — Write-Ahead Logging allows concurrent readers while a write commits!</li>
            <li><code className="text-indigo-400">PRAGMA foreign_keys = ON;</code> — Maintains strict referential integrity between accounts and transactions.</li>
            <li><code className="text-indigo-400">sqlite3_busy_timeout(db, 10000);</code> — Prevents immediate busy lock failures under contention.</li>
            <li><strong>Separate SQLite handles:</strong> Each worker thread opens its own connection (<code className="text-indigo-400">sqlite3_open_v2</code>) with <code className="text-indigo-400">SQLITE_OPEN_FULLMUTEX</code>.</li>
            <li><strong>Our C Synchronization Controller:</strong> Regulates logical database access, while SQLite provides physical ACID data integrity.</li>
          </ul>
        </div>
      )}
    </div>
  );
};
