import React from 'react';
import { Info, Users, Layers, Cpu, Server, Database, Globe } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const team = [
    { name: 'B. Thrinadh', roll: '2520030529', role: 'Systems & Concurrency Lead' },
    { name: 'Madhan', roll: '2520030263', role: 'Database & Synchronization Specialist' },
    { name: 'M. Nihal', roll: '2520030124', role: 'Full-Stack Integration & Architecture' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            OPERATING SYSTEMS CAPSTONE PROJECT
          </span>
          <span className="text-xs text-slate-400 font-mono">GROUP G-15</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mt-3">
          Readers–Writers Concurrent Database Simulator
        </h1>
        <p className="text-sm font-semibold text-indigo-400 mt-1">SyncDB Lab</p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          A full-stack Ubuntu Linux Operating Systems project demonstrating the classical Readers–Writers
          synchronization problem using actual C POSIX threads, mutexes, condition variables, and genuine SQLite ACID database operations.
        </p>
      </div>

      {/* Team Members */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Project Team (Group G-15)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {team.map((member) => (
            <div
              key={member.roll}
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 transition-all"
            >
              <div className="font-bold text-sm text-white">{member.name}</div>
              <div className="text-xs font-mono text-indigo-400 mt-0.5">{member.roll}</div>
              <div className="text-[11px] text-slate-400 mt-2">{member.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4-Layer Architecture */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Strict Four-Layer System Architecture</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-teal-900/40 bg-teal-950/20 space-y-2">
            <div className="flex items-center space-x-1.5 text-teal-400 font-bold text-xs uppercase">
              <Globe className="w-4 h-4" />
              <span>Layer 1: Frontend</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              React, TypeScript, Vite, Tailwind CSS, Recharts. Visualizes genuine engine activity and provides real-time interaction.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 space-y-2">
            <div className="flex items-center space-x-1.5 text-indigo-400 font-bold text-xs uppercase">
              <Server className="w-4 h-4" />
              <span>Layer 2: Backend</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              FastAPI, Python 3.10+, WebSockets. Manages engine subprocess lifecycle, request correlation, event streaming, and persistence.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-purple-900/40 bg-purple-950/20 space-y-2">
            <div className="flex items-center space-x-1.5 text-purple-400 font-bold text-xs uppercase">
              <Cpu className="w-4 h-4" />
              <span>Layer 3: C Engine</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              C11, POSIX Threads (<code className="text-purple-300">pthread</code>), mutexes, condition variables. Real multithreaded synchronization.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 space-y-2">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs uppercase">
              <Database className="w-4 h-4" />
              <span>Layer 4: SQLite</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              SQLite3 C API in WAL mode. Stores accounts and transactions in Indian paise. Executes genuine concurrent SELECTs and serialized UPDATEs.
            </p>
          </div>
        </div>
      </div>

      {/* Problem Statement & Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>Problem Statement</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            In operating systems, shared database access requires synchronizing multiple concurrent processes.
            Multiple readers may inspect records simultaneously without conflict, but a writer requires exclusive access
            to prevent race conditions, lost updates, and corrupted balances.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Project Objectives</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Implement and empirically evaluate the three classic synchronization policies (Reader Preference,
            Writer Preference, and Fair FIFO Scheduling) with real POSIX threads and high-precision monotonic timing,
            providing an integrated visualizer for academic demonstration and viva examination.
          </p>
        </div>
      </div>
    </div>
  );
};
