import React from 'react';
import { Database, Lock, Unlock, Users, ShieldAlert, Cpu } from 'lucide-react';
import { Metrics, ThreadNode } from '../types';

interface ResourceVisualizerProps {
  metrics: Metrics;
  threads: ThreadNode[];
}

export const ResourceVisualizer: React.FC<ResourceVisualizerProps> = ({ metrics, threads }) => {
  const activeReaderThreads = threads.filter(
    (t) => t.role === 'READER' && (t.state === 'READING' || t.state === 'ACQUIRED')
  );
  const activeWriterThread = threads.find(
    (t) => t.role === 'WRITER' && (t.state === 'WRITING' || t.state === 'ACQUIRED')
  );
  const waitingThreads = threads.filter(
    (t) => t.state === 'QUEUED' || t.state === 'WAITING'
  );

  const isWriterActive = metrics.active_writers > 0;
  const isReaderActive = metrics.active_readers > 0;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>Shared Database Resource Monitor</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time visualization of POSIX pthread critical-section access
          </p>
        </div>

        {/* Invariant Status Pill */}
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          {metrics.sync_violations === 0 ? (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Invariants OK (0 Violations)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-mono font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
              <span>{metrics.sync_violations} VIOLATIONS DETECTED</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Left: Active Readers Panel */}
        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10 min-h-[160px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Active Readers (Shared)</span>
            </span>
            <span className="text-lg font-mono font-extrabold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">
              {metrics.active_readers}
            </span>
          </div>

          <div className="my-3 flex flex-wrap gap-2">
            {activeReaderThreads.length > 0 ? (
              activeReaderThreads.map((t) => (
                <div
                  key={t.op_id}
                  className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center space-x-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{t.op_id}</span>
                  <span className="text-[10px] text-emerald-200">({t.account_id})</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No readers currently reading</span>
            )}
          </div>

          <p className="text-[11px] text-emerald-400/80">
            {isReaderActive
              ? 'Shared gate held: concurrent reads permitted'
              : 'Reader gate idle'}
          </p>
        </div>

        {/* Center: The Core Database Resource Gate */}
        <div className="relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-700/80 bg-slate-950/80 shadow-inner">
          <div
            className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 ${
              isWriterActive
                ? 'bg-indigo-950/80 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]'
                : isReaderActive
                ? 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <Database
              className={`w-8 h-8 mb-1 ${
                isWriterActive
                  ? 'text-indigo-400 animate-spin'
                  : isReaderActive
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              SQLite WAL
            </span>
          </div>

          <div className="mt-3 text-center">
            <div className="flex items-center justify-center space-x-1.5">
              {isWriterActive || isReaderActive ? (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="text-xs font-bold font-mono">
                {isWriterActive
                  ? 'EXCLUSIVE WRITER LOCK'
                  : isReaderActive
                  ? `SHARED READ LOCK (${metrics.active_readers})`
                  : 'RESOURCE UNLOCKED (IDLE)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Target: database/syncdb.sqlite3
            </p>
          </div>
        </div>

        {/* Right: Active Writer Panel */}
        <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/10 min-h-[160px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Active Writer (Exclusive)</span>
            </span>
            <span className="text-lg font-mono font-extrabold text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded">
              {metrics.active_writers}
            </span>
          </div>

          <div className="my-3">
            {activeWriterThread ? (
              <div className="px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-200 font-mono text-xs flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="font-bold">{activeWriterThread.op_id}</span>
                </div>
                <span className="text-[11px] text-indigo-300">
                  Account: {activeWriterThread.account_id}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">No writer currently writing</span>
            )}
          </div>

          <p className="text-[11px] text-indigo-400/80">
            {isWriterActive
              ? 'Exclusive write in progress: all reads and writes blocked'
              : 'Writer gate idle'}
          </p>
        </div>
      </div>

      {/* Bottom: Waiting Queue */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Scheduling Queue ({waitingThreads.length} Waiting)
          </span>
          <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
            <span>Waiting Readers: <strong className="text-emerald-400">{metrics.waiting_readers}</strong></span>
            <span>Waiting Writers: <strong className="text-indigo-400">{metrics.waiting_writers}</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto py-2">
          {waitingThreads.length > 0 ? (
            waitingThreads.map((t) => (
              <div
                key={t.op_id}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-2 ${
                  t.role === 'READER'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-indigo-950/40 border-indigo-800 text-indigo-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    t.role === 'READER' ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`}
                />
                <span className="font-bold">{t.op_id}</span>
                <span className="text-[10px] opacity-75">[{t.role}]</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic py-1">
              Scheduling queue is empty. Ready to accept operations.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
