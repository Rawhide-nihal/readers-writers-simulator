import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { DatabaseManagerPage } from './pages/DatabaseManagerPage';
import { SimulationControlPage } from './pages/SimulationControlPage';
import { LiveVisualizerPage } from './pages/LiveVisualizerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { AlgorithmExplainerPage } from './pages/AlgorithmExplainerPage';
import { AboutPage } from './pages/AboutPage';
import { api } from './services/api';
import { wsService } from './services/websocket';
import { EngineStatus, EngineEvent, ThreadNode, Account, SimState, SyncPolicy } from './types';

export const App: React.FC = () => {
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [threads, setThreads] = useState<ThreadNode[]>([]);

  // Initial data fetch
  const refreshSnapshot = async () => {
    try {
      const snap = await api.getCurrentSimulation();
      setEngineStatus(snap);
      if (snap.accounts) {
        setAccounts(snap.accounts);
      }
    } catch (e) {
      console.warn('Failed to load initial simulation snapshot:', e);
    }
  };

  useEffect(() => {
    // 1. Initial REST fetch
    refreshSnapshot();

    // 2. Connect WebSocket
    wsService.connect();
    const unsubStatus = wsService.subscribeStatus((st) => setWsStatus(st));

    // 3. Subscribe to real-time events
    const unsubEvents = wsService.subscribeEvents((event: EngineEvent) => {
      setEvents((prev) => [...prev.slice(-499), event]);

      // If status/metrics updated in event
      if (event.metrics) {
        setEngineStatus((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            policy: event.policy || prev.policy,
            metrics: {
              ...prev.metrics,
              ...event.metrics,
            },
          };
        });
      }

      // Update thread worker nodes
      if (event.op_id && event.op_id !== 'SYSTEM') {
        setThreads((prev) => {
          const existingIdx = prev.findIndex((t) => t.op_id === event.op_id);
          const now = Date.now();
          const details = event.details || {};

          if (existingIdx >= 0) {
            const updated = [...prev];
            const curr = updated[existingIdx];
            updated[existingIdx] = {
              ...curr,
              state: event.state,
              account_id: event.account_id || curr.account_id,
              wait_duration_ms: details.wait_duration_ms ?? curr.wait_duration_ms,
              execution_duration_ms: details.execution_duration_ms ?? curr.execution_duration_ms,
              last_event_time: now,
            };
            return updated;
          } else {
            const newNode: ThreadNode = {
              op_id: event.op_id,
              role: event.role === 'READER' ? 'READER' : 'WRITER',
              state: event.state,
              account_id: event.account_id,
              arrival_time_ms: event.monotonic_ms,
              last_event_time: now,
            };
            return [...prev.slice(-99), newNode];
          }
        });
      }

      // Refresh accounts on completion or database changes
      if (
        event.event === 'EXPERIMENT_FINISHED' ||
        event.event === 'DATABASE_RESET' ||
        event.event === 'DB_WRITE_END'
      ) {
        refreshSnapshot();
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, []);

  const simState: SimState = engineStatus?.sim_state || 'IDLE';
  const policy: SyncPolicy = engineStatus?.policy || 'READER_PREFERENCE';
  const metrics = engineStatus?.metrics || {
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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout
              wsStatus={wsStatus}
              simState={simState}
              policy={policy}
              onRefreshData={refreshSnapshot}
            />
          }
        >
          <Route
            index
            element={
              <DashboardPage
                status={engineStatus}
                accounts={accounts}
                threads={threads}
              />
            }
          />
          <Route path="/database" element={<DatabaseManagerPage />} />
          <Route
            path="/simulation"
            element={
              <SimulationControlPage
                simState={simState}
                currentPolicy={policy}
                onRefresh={refreshSnapshot}
              />
            }
          />
          <Route
            path="/visualizer"
            element={
              <LiveVisualizerPage
                metrics={metrics}
                threads={threads}
              />
            }
          />
          <Route
            path="/analytics"
            element={<AnalyticsPage currentMetrics={metrics} />}
          />
          <Route
            path="/logs"
            element={
              <ActivityLogsPage
                events={events}
                onClearLogs={() => setEvents([])}
              />
            }
          />
          <Route path="/explainer" element={<AlgorithmExplainerPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
