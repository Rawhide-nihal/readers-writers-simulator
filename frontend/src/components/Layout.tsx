import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Modal } from './Modal';
import { api } from '../services/api';
import { SimState, SyncPolicy } from '../types';

interface LayoutProps {
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  simState: SimState;
  policy: SyncPolicy;
  onRefreshData?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ wsStatus, simState, policy, onRefreshData }) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      setResetError(null);
      await api.resetDatabase();
      setIsResetModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setResetError(err.message || 'Database reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          wsStatus={wsStatus}
          simState={simState}
          policy={policy}
          onResetDatabase={() => setIsResetModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* Confirmation Modal for Resetting Database */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset SQLite Database"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to restore the database to its initial seed data?
            This will drop and recreate all account records and transaction logs in <code className="text-indigo-400 font-mono">database/syncdb.sqlite3</code>.
          </p>

          {resetError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
              {resetError}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReset}
              disabled={isResetting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5"
            >
              {isResetting ? 'Resetting...' : 'Yes, Reset Database'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
