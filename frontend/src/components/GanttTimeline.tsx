import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ThreadNode } from '../types';

interface GanttTimelineProps {
  threads: ThreadNode[];
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({ threads }) => {
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);

  if (threads.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No active or recorded thread operations</p>
        <p className="text-xs mt-1">Run a simulation from the Simulation Lab to inspect Gantt execution timings</p>
      </div>
    );
  }

  // Find min arrival time to establish relative timeline baseline
  const minTime = Math.min(...threads.map((t) => t.arrival_time_ms || t.last_event_time));
  const maxTime = Math.max(...threads.map((t) => t.release_time_ms || t.last_event_time || (minTime + 1000)));
  const totalDuration = Math.max(maxTime - minTime, 100);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Real POSIX Thread Execution Timeline (Gantt)</span>
        </h3>
        <span className="text-xs font-mono text-slate-400">
          Duration span: {totalDuration.toFixed(1)} ms
        </span>
      </div>

      <div className="space-y-3">
        {threads.map((thread) => {
          const arrival = thread.arrival_time_ms || minTime;
          const acquired = thread.acquired_time_ms || arrival;
          const release = thread.release_time_ms || thread.last_event_time;

          const waitLeftPercent = Math.max(0, Math.min(100, ((arrival - minTime) / totalDuration) * 100));
          const waitWidthPercent = Math.max(1, Math.min(100, ((acquired - arrival) / totalDuration) * 100));

          const execLeftPercent = Math.max(0, Math.min(100, ((acquired - minTime) / totalDuration) * 100));
          const execWidthPercent = Math.max(2, Math.min(100, ((release - acquired) / totalDuration) * 100));

          const isExpanded = expandedOpId === thread.op_id;

          return (
            <div
              key={thread.op_id}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedOpId(isExpanded ? null : thread.op_id)}
              >
                <div className="flex items-center space-x-2.5 w-44">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span
                    className={`font-mono font-bold ${
                      thread.role === 'READER' ? 'text-emerald-400' : 'text-indigo-400'
                    }`}
                  >
                    {thread.op_id}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      thread.role === 'READER'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {thread.role}
                  </span>
                </div>

                {/* Timeline Bar */}
                <div className="flex-1 mx-4 relative h-6 bg-slate-900 rounded overflow-hidden flex items-center">
                  {/* Waiting segment (Amber) */}
                  <div
                    style={{ left: `${waitLeftPercent}%`, width: `${waitWidthPercent}%` }}
                    className="absolute h-full bg-amber-500/30 border-r border-amber-500/80"
                    title={`Waiting: ${((thread.wait_duration_ms || (acquired - arrival))).toFixed(1)} ms`}
                  />

                  {/* Execution segment (Teal for reader, Indigo for writer) */}
                  <div
                    style={{ left: `${execLeftPercent}%`, width: `${execWidthPercent}%` }}
                    className={`absolute h-full flex items-center justify-center font-mono text-[10px] font-bold text-white shadow-sm ${
                      thread.role === 'READER'
                        ? 'bg-emerald-600/80 border border-emerald-400'
                        : 'bg-indigo-600/80 border border-indigo-400'
                    }`}
                    title={`Execution: ${((thread.execution_duration_ms || (release - acquired))).toFixed(1)} ms`}
                  >
                    <span className="truncate px-1">
                      {thread.role === 'READER' ? 'READ' : 'WRITE'}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="w-28 text-right flex items-center justify-end space-x-1.5 font-mono">
                  {thread.state === 'COMPLETED' ? (
                    <span className="text-emerald-400 flex items-center space-x-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </span>
                  ) : thread.state === 'FAILED' ? (
                    <span className="text-rose-400 flex items-center space-x-1 text-[11px]">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Failed</span>
                    </span>
                  ) : thread.state === 'CANCELLED' ? (
                    <span className="text-slate-400 flex items-center space-x-1 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Cancelled</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 animate-pulse text-[11px]">
                      {thread.state}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-2.5 pt-2 border-t border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                  <div>Account: <span className="text-white font-bold">{thread.account_id}</span></div>
                  <div>Wait Time: <span className="text-amber-400 font-bold">{((thread.wait_duration_ms || (acquired - arrival))).toFixed(1)} ms</span></div>
                  <div>Exec Time: <span className="text-indigo-400 font-bold">{((thread.execution_duration_ms || (release - acquired))).toFixed(1)} ms</span></div>
                  <div>State: <span className="text-emerald-400 font-bold">{thread.state}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
