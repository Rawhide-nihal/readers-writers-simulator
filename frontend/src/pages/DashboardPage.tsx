import React from 'react';
import { 
  Users, 
  Lock, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Database,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { ResourceVisualizer } from '../components/ResourceVisualizer';
import { Metrics, ThreadNode, Account, EngineStatus } from '../types';

interface DashboardPageProps {
  status: EngineStatus | null;
  accounts: Account[];
  threads: ThreadNode[];
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ status, accounts, threads }) => {
  const metrics: Metrics = status?.metrics || {
    active_readers: 0,
    active_writers: 0,
    waiting_readers: 0,
    waiting_writers: 0,
    completed_readers: 0,
    completed_writers: 0,
    failed_operations: 0,
    cancelled_operations: 0,
    total_operations: 0,
    max_simultaneous_readers: 0,
    sync_violations: 0,
    avg_reader_wait_ms: 0,
    avg_writer_wait_ms: 0,
    avg_execution_ms: 0,
    min_wait_ms: 0,
    max_wait_ms: 0,
  };

  const totalCompleted = metrics.completed_readers + metrics.completed_writers;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              OPERATING SYSTEMS CONCURRENCY LAB
            </span>
            <span className="text-xs text-slate-400 font-mono">GROUP G-15</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            SyncDB Lab Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Simulating classical Readers–Writers synchronization using true Linux C POSIX threads,
            mutexes, condition variables, and an ACID SQLite banking database.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/simulation"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
          >
            <span>Launch Simulation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/database"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1.5"
          >
            <Database className="w-4 h-4" />
            <span>Manage DB</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Readers"
          value={metrics.active_readers}
          subtitle={`Max simultaneous: ${metrics.max_simultaneous_readers}`}
          icon={Users}
          variant="reader"
        />
        <MetricCard
          title="Active Writers"
          value={metrics.active_writers}
          subtitle="Exclusive access (Max: 1)"
          icon={Lock}
          variant="writer"
        />
        <MetricCard
          title="Waiting Queue"
          value={metrics.waiting_readers + metrics.waiting_writers}
          subtitle={`R: ${metrics.waiting_readers} | W: ${metrics.waiting_writers}`}
          icon={Clock}
          variant="amber"
        />
        <MetricCard
          title="Sync Violations"
          value={metrics.sync_violations}
          subtitle="Strict invariant check"
          icon={ShieldCheck}
          variant={metrics.sync_violations > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Completed Operations"
          value={totalCompleted}
          subtitle={`R: ${metrics.completed_readers} | W: ${metrics.completed_writers}`}
          icon={CheckCircle2}
          variant="neutral"
        />
        <MetricCard
          title="Avg Reader Wait"
          value={`${metrics.avg_reader_wait_ms.toFixed(1)} ms`}
          subtitle="Monotonic timer"
          icon={Clock}
          variant="reader"
        />
        <MetricCard
          title="Avg Writer Wait"
          value={`${metrics.avg_writer_wait_ms.toFixed(1)} ms`}
          subtitle="Contention delay"
          icon={Clock}
          variant="writer"
        />
        <MetricCard
          title="Avg Execution Time"
          value={`${metrics.avg_execution_ms.toFixed(1)} ms`}
          subtitle="Critical section duration"
          icon={TrendingUp}
          variant="neutral"
        />
      </div>

      {/* Central Interactive Resource Monitor */}
      <ResourceVisualizer metrics={metrics} threads={threads} />

      {/* Authoritative Database Accounts Summary */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Current SQLite Database State</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live account records stored in <code className="text-indigo-400 font-mono">database/syncdb.sqlite3</code>
            </p>
          </div>
          <Link
            to="/database"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
          >
            <span>View All Operations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Account ID</th>
                <th className="py-2.5 px-3">Holder Name</th>
                <th className="py-2.5 px-3">Balance (₹ Rupees)</th>
                <th className="py-2.5 px-3">Balance (Paise)</th>
                <th className="py-2.5 px-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {accounts.slice(0, 5).map((acc) => (
                <tr key={acc.account_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                    {acc.account_id}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200">{acc.holder_name}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                    ₹{(acc.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {acc.balance_paise.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                    {acc.updated_at || 'Seeded'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
