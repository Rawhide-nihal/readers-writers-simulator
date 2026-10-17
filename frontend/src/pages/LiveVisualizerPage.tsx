import React, { useState } from 'react';
import { 
  Cpu, 
  Filter, 
  Users, 
  Lock, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { ThreadNode, Metrics } from '../types';
import { ResourceVisualizer } from '../components/ResourceVisualizer';
import { GanttTimeline } from '../components/GanttTimeline';

interface LiveVisualizerPageProps {
  metrics: Metrics;
  threads: ThreadNode[];
}

export const LiveVisualizerPage: React.FC<LiveVisualizerPageProps> = ({ metrics, threads }) => {
  const [filterRole, setFilterRole] = useState<'ALL' | 'READER' | 'WRITER'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'WAITING' | 'COMPLETED'>('ALL');

  const filteredThreads = threads.filter((t) => {
    if (filterRole !== 'ALL' && t.role !== filterRole) return false;
    if (filterStatus === 'ACTIVE') {
      return t.state === 'READING' || t.state === 'WRITING' || t.state === 'ACQUIRED';
    }
    if (filterStatus === 'WAITING') {
      return t.state === 'QUEUED' || t.state === 'WAITING';
    }
    if (filterStatus === 'COMPLETED') {
      return t.state === 'COMPLETED' || t.state === 'FAILED' || t.state === 'CANCELLED';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span>Live POSIX Thread Visualizer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time synchronization states, mutex lock ownership, and Gantt execution timeline
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <div className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300">
            Active R: <strong className="font-bold">{metrics.active_readers}</strong>
          </div>
          <div className="px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800 text-indigo-300">
            Active W: <strong className="font-bold">{metrics.active_writers}</strong>
          </div>
          <div className="px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300">
            Waiting: <strong className="font-bold">{metrics.waiting_readers + metrics.waiting_writers}</strong>
          </div>
        </div>
      </div>

      {/* Central Resource Gate Visualizer */}
      <ResourceVisualizer metrics={metrics} threads={threads} />

      {/* Gantt Execution Timeline */}
      <GanttTimeline threads={threads} />

      {/* Individual Worker Thread Cards */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Thread Worker Nodes ({filteredThreads.length} Displayed)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Individual pthread worker lifecycle states and operation timings
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setFilterRole('ALL')}
                className={`px-2 py-0.5 rounded ${filterRole === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
              >
                All Roles
              </button>
              <button
                onClick={() => setFilterRole('READER')}
                className={`px-2 py-0.5 rounded ${filterRole === 'READER' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Readers
              </button>
              <button
                onClick={() => setFilterRole('WRITER')}
                className={`px-2 py-0.5 rounded ${filterRole === 'WRITER' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Writers
              </button>
            </div>

            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-0.5 rounded ${filterStatus === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
              >
                All States
              </button>
              <button
                onClick={() => setFilterStatus('ACTIVE')}
                className={`px-2 py-0.5 rounded ${filterStatus === 'ACTIVE' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('WAITING')}
                className={`px-2 py-0.5 rounded ${filterStatus === 'WAITING' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Waiting
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`px-2 py-0.5 rounded ${filterStatus === 'COMPLETED' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                Done
              </button>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredThreads.map((thread) => {
            const isReader = thread.role === 'READER';
            const isActive = thread.state === 'READING' || thread.state === 'WRITING' || thread.state === 'ACQUIRED';
            const isWaiting = thread.state === 'QUEUED' || thread.state === 'WAITING';
            const isDone = thread.state === 'COMPLETED';

            return (
              <div
                key={thread.op_id}
                className={`p-4 rounded-xl border transition-all ${
                  isActive
                    ? isReader
                      ? 'bg-emerald-950/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-indigo-950/30 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : isWaiting
                    ? 'bg-amber-950/20 border-amber-800/60'
                    : isDone
                    ? 'bg-slate-950/50 border-slate-800/80'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-white text-xs">{thread.op_id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isReader
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {thread.role}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>State:</span>
                    <span
                      className={`font-bold ${
                        isActive
                          ? isReader
                            ? 'text-emerald-400 animate-pulse'
                            : 'text-indigo-400 animate-pulse'
                          : isWaiting
                          ? 'text-amber-400'
                          : isDone
                          ? 'text-slate-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {thread.state}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Target:</span>
                    <span className="text-white font-medium">{thread.account_id}</span>
                  </div>

                  {thread.wait_duration_ms !== undefined && (
                    <div className="flex justify-between">
                      <span>Wait Time:</span>
                      <span className="text-amber-400 font-bold">{thread.wait_duration_ms.toFixed(1)} ms</span>
                    </div>
                  )}

                  {thread.execution_duration_ms !== undefined && (
                    <div className="flex justify-between">
                      <span>Exec Time:</span>
                      <span className="text-indigo-400 font-bold">{thread.execution_duration_ms.toFixed(1)} ms</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredThreads.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">
            No thread worker nodes match the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};
