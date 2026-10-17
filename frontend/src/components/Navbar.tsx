import React from 'react';
import { Activity, ShieldCheck, Cpu, RefreshCw } from 'lucide-react';
import { SimState, SyncPolicy } from '../types';

interface NavbarProps {
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  simState: SimState;
  policy: SyncPolicy;
  onResetDatabase?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ wsStatus, simState, policy, onResetDatabase }) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              SyncDB Lab
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-mono text-slate-300">
              G-15
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Readers–Writers Concurrent Database Simulator
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Engine WebSocket Status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'CONNECTED'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                : wsStatus === 'CONNECTING'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {wsStatus === 'CONNECTED' ? 'Engine Online' : wsStatus === 'CONNECTING' ? 'Connecting...' : 'Engine Offline'}
          </span>
        </div>

        {/* Active Policy Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-950/60 border border-indigo-800/60 text-xs text-indigo-300">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono text-[11px]">
            {policy === 'READER_PREFERENCE'
              ? 'Reader Pref'
              : policy === 'WRITER_PREFERENCE'
              ? 'Writer Pref'
              : 'Fair FIFO'}
          </span>
        </div>

        {/* Sim State Badge */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${
            simState === 'RUNNING'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : simState === 'PAUSED'
              ? 'bg-amber-950/60 border-amber-800 text-amber-300'
              : simState === 'STOPPED'
              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{simState}</span>
        </div>

        {/* Reset Database Quick Action */}
        {onResetDatabase && (
          <button
            onClick={onResetDatabase}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
            title="Reset database to initial seed data"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Reset DB</span>
          </button>
        )}
      </div>
    </header>
  );
};
