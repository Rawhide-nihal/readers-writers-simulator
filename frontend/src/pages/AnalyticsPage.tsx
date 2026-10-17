import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  Lock, 
  ShieldCheck, 
  Zap, 
  RefreshCw 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { api } from '../services/api';
import { Metrics, ExperimentRecord } from '../types';

interface AnalyticsPageProps {
  currentMetrics: Metrics;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ currentMetrics }) => {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [comparisons, setComparisons] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const exps = await api.listExperiments();
      setExperiments(exps);
      const comps = await api.getPolicyComparison();
      setComparisons(comps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Waiting Time chart data
  const waitTimeData = [
    {
      name: 'Readers',
      'Avg Wait (ms)': currentMetrics.avg_reader_wait_ms,
      fill: '#10b981',
    },
    {
      name: 'Writers',
      'Avg Wait (ms)': currentMetrics.avg_writer_wait_ms,
      fill: '#6366f1',
    },
    {
      name: 'Min Wait',
      'Avg Wait (ms)': currentMetrics.min_wait_ms,
      fill: '#06b6d4',
    },
    {
      name: 'Max Wait',
      'Avg Wait (ms)': currentMetrics.max_wait_ms,
      fill: '#f59e0b',
    },
  ];

  // Distribution chart data
  const totalCompleted = currentMetrics.completed_readers + currentMetrics.completed_writers;
  const distributionData = [
    { name: 'Completed Readers', value: currentMetrics.completed_readers, color: '#10b981' },
    { name: 'Completed Writers', value: currentMetrics.completed_writers, color: '#6366f1' },
    { name: 'Failed Ops', value: currentMetrics.failed_operations, color: '#ef4444' },
    { name: 'Cancelled Ops', value: currentMetrics.cancelled_operations, color: '#64748b' },
  ].filter((d) => d.value > 0);

  // Policy comparison chart data
  const policyComparisonData = Object.entries(comparisons).map(([policy, runs]) => {
    const avgR = runs.reduce((acc, r) => acc + (r.avg_reader_wait_ms || 0), 0) / (runs.length || 1);
    const avgW = runs.reduce((acc, r) => acc + (r.avg_writer_wait_ms || 0), 0) / (runs.length || 1);
    return {
      policy: policy.replace('_', ' '),
      'Reader Wait (ms)': Math.round(avgR),
      'Writer Wait (ms)': Math.round(avgW),
      runs: runs.length,
    };
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Performance & Synchronization Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real performance metrics measured using high-precision POSIX monotonic timestamps
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <p className="text-xs font-medium text-slate-400">Total Ops Processed</p>
          <p className="text-2xl font-extrabold mt-1 font-mono text-white">{totalCompleted}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Submitted: {currentMetrics.total_operations}</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 backdrop-blur-md">
          <p className="text-xs font-medium text-emerald-400">Avg Reader Wait</p>
          <p className="text-2xl font-extrabold mt-1 font-mono text-emerald-400">
            {currentMetrics.avg_reader_wait_ms.toFixed(1)} ms
          </p>
          <p className="text-[11px] text-emerald-500/80 mt-0.5">Completed: {currentMetrics.completed_readers}</p>
        </div>

        <div className="p-4 rounded-xl border border-indigo-900/50 bg-indigo-950/20 backdrop-blur-md">
          <p className="text-xs font-medium text-indigo-400">Avg Writer Wait</p>
          <p className="text-2xl font-extrabold mt-1 font-mono text-indigo-400">
            {currentMetrics.avg_writer_wait_ms.toFixed(1)} ms
          </p>
          <p className="text-[11px] text-indigo-500/80 mt-0.5">Completed: {currentMetrics.completed_writers}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <p className="text-xs font-medium text-slate-400">Max Simultaneous Readers</p>
          <p className="text-2xl font-extrabold mt-1 font-mono text-teal-400">
            {currentMetrics.max_simultaneous_readers}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Demonstrating true concurrency</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Times Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Observed Waiting Times Breakdown (ms)</span>
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitTimeData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="Avg Wait (ms)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operation Status Distribution */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Operation Outcome Distribution</span>
          </h2>
          <div className="h-64 flex items-center justify-center">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-500 text-xs">
                No completed operations recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Policy Comparison Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Cross-Policy Benchmark Comparison</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Comparing Reader Preference, Writer Preference, and Fair FIFO across recorded runs
        </p>

        {policyComparisonData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={policyComparisonData}>
                <XAxis dataKey="policy" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar dataKey="Reader Wait (ms)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Writer Wait (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            Run experiments with Reader Preference, Writer Preference, and Fair Scheduling in the Simulation Lab to generate benchmark comparative data.
          </div>
        )}
      </div>
    </div>
  );
};
