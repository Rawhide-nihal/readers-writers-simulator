import React, { useState, useRef, useEffect } from 'react';
import { 
  ScrollText, 
  Search, 
  Download, 
  Trash2, 
  ArrowDownCircle, 
  Filter 
} from 'lucide-react';
import { EngineEvent } from '../types';

interface ActivityLogsPageProps {
  events: EngineEvent[];
  onClearLogs?: () => void;
}

export const ActivityLogsPage: React.FC<ActivityLogsPageProps> = ({ events, onClearLogs }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'READER' | 'WRITER' | 'SYSTEM'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const filtered = events.filter((ev) => {
    if (roleFilter !== 'ALL' && ev.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchOp = ev.op_id.toLowerCase().includes(q);
      const matchEv = ev.event.toLowerCase().includes(q);
      const matchAcc = ev.account_id.toLowerCase().includes(q);
      const matchState = ev.state.toLowerCase().includes(q);
      if (!matchOp && !matchEv && !matchAcc && !matchState) return false;
    }
    return true;
  });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncdb-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Seq', 'Timestamp', 'Role', 'OpID', 'Event', 'State', 'Account', 'ActiveR', 'ActiveW', 'WaitR', 'WaitW'];
    const rows = events.map((e) => [
      e.seq,
      new Date(e.timestamp_ms).toISOString(),
      e.role,
      e.op_id,
      e.event,
      e.state,
      e.account_id,
      e.metrics?.active_readers ?? 0,
      e.metrics?.active_writers ?? 0,
      e.metrics?.waiting_readers ?? 0,
      e.metrics?.waiting_writers ?? 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncdb-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <ScrollText className="w-5 h-5 text-indigo-400" />
            <span>Activity Logs & Event Stream</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit log of POSIX thread lifecycle events and SQLite transactions
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportJSON}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
              title="Clear log viewer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Op ID, account, event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono w-full md:w-auto justify-between md:justify-end">
          {/* Role Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-2 py-0.5 rounded ${roleFilter === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
            >
              All
            </button>
            <button
              onClick={() => setRoleFilter('READER')}
              className={`px-2 py-0.5 rounded ${roleFilter === 'READER' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
            >
              Readers
            </button>
            <button
              onClick={() => setRoleFilter('WRITER')}
              className={`px-2 py-0.5 rounded ${roleFilter === 'WRITER' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
            >
              Writers
            </button>
            <button
              onClick={() => setRoleFilter('SYSTEM')}
              className={`px-2 py-0.5 rounded ${roleFilter === 'SYSTEM' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
            >
              System
            </button>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-1.5 ${
              autoScroll
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>Auto-scroll: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner font-mono text-xs">
        <div className="max-h-[550px] overflow-y-auto divide-y divide-slate-850">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 z-10 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Op ID</th>
                <th className="py-2.5 px-3">Event</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Counts [R / W / Wait]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filtered.map((ev) => {
                const timeStr = new Date(ev.timestamp_ms).toLocaleTimeString('en-US', { hour12: false });
                const isReader = ev.role === 'READER';
                const isWriter = ev.role === 'WRITER';

                return (
                  <tr key={ev.seq} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2 px-3 text-slate-500 text-[11px]">{ev.seq}</td>
                    <td className="py-2 px-3 text-slate-400">{timeStr}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isReader
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : isWriter
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {ev.role}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-white">{ev.op_id || '—'}</td>
                    <td className="py-2 px-3 text-indigo-300 font-semibold">{ev.event}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[11px] font-medium ${
                          ev.state === 'READING'
                            ? 'text-emerald-400'
                            : ev.state === 'WRITING'
                            ? 'text-indigo-400'
                            : ev.state === 'WAITING'
                            ? 'text-amber-400'
                            : ev.state === 'COMPLETED'
                            ? 'text-slate-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {ev.state}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{ev.account_id || '—'}</td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      R:{ev.metrics?.active_readers ?? 0} | W:{ev.metrics?.active_writers ?? 0} | Q:
                      {(ev.metrics?.waiting_readers ?? 0) + (ev.metrics?.waiting_writers ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              No activity log events match your filter criteria.
            </div>
          )}

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
