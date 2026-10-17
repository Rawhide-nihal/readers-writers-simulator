import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Settings2, 
  Sliders, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';
import { SimulationConfig, SyncPolicy, ArrivalPattern, WriterOpType, SimState } from '../types';

interface SimulationControlPageProps {
  simState: SimState;
  currentPolicy: SyncPolicy;
  onRefresh?: () => void;
}

export const SimulationControlPage: React.FC<SimulationControlPageProps> = ({
  simState,
  currentPolicy,
  onRefresh,
}) => {
  const [config, setConfig] = useState<SimulationConfig>({
    readers_count: 5,
    writers_count: 2,
    policy: currentPolicy || 'READER_PREFERENCE',
    reader_workload_ms: 800,
    writer_workload_ms: 1200,
    arrival_pattern: 'BURST',
    arrival_interval_ms: 150,
    account_id: 'ACC001',
    writer_op_type: 'DEPOSIT',
    seed: 42,
  });

  const [activePreset, setActivePreset] = useState<string>('Preset C: Mixed Workload');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const presets = [
    {
      name: 'Preset A: Multiple Readers',
      desc: '5 Readers, 0 Writers. Demonstrates genuine concurrent shared read access with 0 contention.',
      config: {
        readers_count: 5,
        writers_count: 0,
        policy: 'READER_PREFERENCE' as SyncPolicy,
        reader_workload_ms: 800,
        writer_workload_ms: 1200,
        arrival_pattern: 'BURST' as ArrivalPattern,
        arrival_interval_ms: 150,
        account_id: 'ACC001',
        writer_op_type: 'DEPOSIT' as WriterOpType,
        seed: 42,
      },
    },
    {
      name: 'Preset B: Writer Exclusivity',
      desc: '0 Readers, 3 Writers. Demonstrates that writers execute strictly one-at-a-time (active writers <= 1).',
      config: {
        readers_count: 0,
        writers_count: 3,
        policy: 'READER_PREFERENCE' as SyncPolicy,
        reader_workload_ms: 800,
        writer_workload_ms: 1200,
        arrival_pattern: 'BURST' as ArrivalPattern,
        arrival_interval_ms: 150,
        account_id: 'ACC001',
        writer_op_type: 'DEPOSIT' as WriterOpType,
        seed: 42,
      },
    },
    {
      name: 'Preset C: Mixed Workload',
      desc: '5 Readers, 2 Writers. Interleaved read/write contention demonstrating mutual exclusion.',
      config: {
        readers_count: 5,
        writers_count: 2,
        policy: 'READER_PREFERENCE' as SyncPolicy,
        reader_workload_ms: 800,
        writer_workload_ms: 1200,
        arrival_pattern: 'BURST' as ArrivalPattern,
        arrival_interval_ms: 150,
        account_id: 'ACC001',
        writer_op_type: 'DEPOSIT' as WriterOpType,
        seed: 42,
      },
    },
    {
      name: 'Preset D: Reader-Heavy (Writer Delay)',
      desc: '12 Readers, 2 Writers. In Reader-Preference, sustained reader arrivals delay waiting writers.',
      config: {
        readers_count: 12,
        writers_count: 2,
        policy: 'READER_PREFERENCE' as SyncPolicy,
        reader_workload_ms: 600,
        writer_workload_ms: 1000,
        arrival_pattern: 'STAGGERED' as ArrivalPattern,
        arrival_interval_ms: 200,
        account_id: 'ACC001',
        writer_op_type: 'DEPOSIT' as WriterOpType,
        seed: 42,
      },
    },
    {
      name: 'Preset E: Writer-Heavy (Reader Delay)',
      desc: '2 Readers, 6 Writers. In Writer-Preference, waiting writers get priority over newly arriving readers.',
      config: {
        readers_count: 2,
        writers_count: 6,
        policy: 'WRITER_PREFERENCE' as SyncPolicy,
        reader_workload_ms: 600,
        writer_workload_ms: 1000,
        arrival_pattern: 'STAGGERED' as ArrivalPattern,
        arrival_interval_ms: 200,
        account_id: 'ACC001',
        writer_op_type: 'DEPOSIT' as WriterOpType,
        seed: 42,
      },
    },
    {
      name: 'Preset F: Fair FIFO Scheduling',
      desc: '6 Readers, 4 Writers. Starvation-resistant FIFO queue; adjacent readers batch together without overtaking queued writers.',
      config: {
        readers_count: 6,
        writers_count: 4,
        policy: 'FAIR' as SyncPolicy,
        reader_workload_ms: 700,
        writer_workload_ms: 900,
        arrival_pattern: 'STAGGERED' as ArrivalPattern,
        arrival_interval_ms: 150,
        account_id: 'ACC001',
        writer_op_type: 'TRANSFER' as WriterOpType,
        seed: 42,
      },
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setActivePreset(preset.name);
    setConfig(preset.config);
  };

  const handleStart = async () => {
    try {
      setLoadingAction('START');
      setStatusMessage(null);
      await api.startSimulation(config);
      setStatusMessage({ type: 'success', text: `Simulation started with ${config.readers_count} readers and ${config.writers_count} writers` });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to start simulation' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePause = async () => {
    try {
      setLoadingAction('PAUSE');
      await api.pauseSimulation();
      setStatusMessage({ type: 'success', text: 'Simulation dispatch paused' });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResume = async () => {
    try {
      setLoadingAction('RESUME');
      await api.resumeSimulation();
      setStatusMessage({ type: 'success', text: 'Simulation dispatch resumed' });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStop = async () => {
    try {
      setLoadingAction('STOP');
      await api.stopSimulation();
      setStatusMessage({ type: 'success', text: 'Simulation stopped cleanly' });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const isRunning = simState === 'RUNNING';
  const isPaused = simState === 'PAUSED';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <span>Simulation Control Lab</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure POSIX pthread Readers-Writers workloads, arrival patterns, and algorithms
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center space-x-2">
          {!isRunning && !isPaused ? (
            <button
              onClick={handleStart}
              disabled={loadingAction === 'START'}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-600/30"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Simulation</span>
            </button>
          ) : isRunning ? (
            <>
              <button
                onClick={handlePause}
                disabled={loadingAction === 'PAUSE'}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Pause className="w-4 h-4 fill-white" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleStop}
                disabled={loadingAction === 'STOP'}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleResume}
                disabled={loadingAction === 'RESUME'}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume</span>
              </button>
              <button
                onClick={handleStop}
                disabled={loadingAction === 'STOP'}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Preset Experiments Selection */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Curated Experiment Presets</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.name}
              onClick={() => !isRunning && applyPreset(preset)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                activePreset === preset.name
                  ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-bold text-xs text-indigo-300">{preset.name}</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{preset.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            <span>Workload & Synchronization Parameters</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Total Threads: <strong className="text-white">{config.readers_count + config.writers_count}</strong> (Max 50)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Readers Count */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-300">Reader Threads</span>
              <span className="font-mono font-bold text-emerald-400">{config.readers_count}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              disabled={isRunning}
              value={config.readers_count}
              onChange={(e) => {
                setActivePreset('Custom Configuration');
                setConfig({ ...config, readers_count: parseInt(e.target.value) || 0 });
              }}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Writers Count */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-300">Writer Threads</span>
              <span className="font-mono font-bold text-indigo-400">{config.writers_count}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              disabled={isRunning}
              value={config.writers_count}
              onChange={(e) => {
                setActivePreset('Custom Configuration');
                setConfig({ ...config, writers_count: parseInt(e.target.value) || 0 });
              }}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Synchronization Algorithm Policy */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Synchronization Policy</label>
            <select
              disabled={isRunning}
              value={config.policy}
              onChange={(e) => {
                setActivePreset('Custom Configuration');
                setConfig({ ...config, policy: e.target.value as SyncPolicy });
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="READER_PREFERENCE">1. Reader Preference (Courtois 1st RW)</option>
              <option value="WRITER_PREFERENCE">2. Writer Preference (Courtois 2nd RW)</option>
              <option value="FAIR">3. Fair FIFO Scheduling (Starvation-Resistant)</option>
            </select>
          </div>

          {/* Reader Workload Duration */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-300">Reader Workload Delay</span>
              <span className="font-mono font-bold text-slate-200">{config.reader_workload_ms} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="3000"
              step="50"
              disabled={isRunning}
              value={config.reader_workload_ms}
              onChange={(e) => setConfig({ ...config, reader_workload_ms: parseInt(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Writer Workload Duration */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-300">Writer Workload Delay</span>
              <span className="font-mono font-bold text-slate-200">{config.writer_workload_ms} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="3000"
              step="50"
              disabled={isRunning}
              value={config.writer_workload_ms}
              onChange={(e) => setConfig({ ...config, writer_workload_ms: parseInt(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Arrival Pattern */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Arrival Pattern</label>
            <select
              disabled={isRunning}
              value={config.arrival_pattern}
              onChange={(e) => setConfig({ ...config, arrival_pattern: e.target.value as ArrivalPattern })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="BURST">Simultaneous Burst (0ms gap)</option>
              <option value="STAGGERED">Staggered Arrival (controlled interval)</option>
              <option value="RANDOM">Seeded Random Arrival (reproducible)</option>
            </select>
          </div>

          {/* Arrival Interval */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-300">Arrival Interval</span>
              <span className="font-mono font-bold text-slate-200">{config.arrival_interval_ms} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              disabled={isRunning}
              value={config.arrival_interval_ms}
              onChange={(e) => setConfig({ ...config, arrival_interval_ms: parseInt(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Writer Operation Type */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Writer Action Type</label>
            <select
              disabled={isRunning}
              value={config.writer_op_type}
              onChange={(e) => setConfig({ ...config, writer_op_type: e.target.value as WriterOpType })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="DEPOSIT">Deposit (+₹2,000)</option>
              <option value="WITHDRAW">Withdraw (-₹1,000)</option>
              <option value="TRANSFER">Atomic Transfer (ACC001 -&gt; ACC002 ₹500)</option>
            </select>
          </div>

          {/* Target Account ID */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Target Account</label>
            <input
              type="text"
              disabled={isRunning}
              value={config.account_id}
              onChange={(e) => setConfig({ ...config, account_id: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
