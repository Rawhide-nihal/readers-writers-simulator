import { 
  Account, 
  Transaction, 
  EngineStatus, 
  SimulationConfig, 
  ExperimentRecord,
  EngineEvent
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.detail || json.error || json.message || 'Request failed');
  }
  return json.data;
}

export const api = {
  // Health & Status
  getHealth: () => request<{ status: string; engine_running: boolean; project: string }>('/health'),
  getEngineStatus: () => request<EngineStatus>('/engine/status'),
  getCurrentSimulation: () => request<EngineStatus>('/simulations/current'),

  // Accounts
  listAccounts: () => request<{ accounts: Account[]; count: number }>('/accounts'),
  getAccount: (id: string) => request<Account>(`/accounts/${id}`),
  createAccount: (data: { account_id: string; holder_name: string; balance_paise: number }) =>
    request<any>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: { holder_name: string }) =>
    request<any>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    request<any>(`/accounts/${id}`, { method: 'DELETE' }),
  resetDatabase: () =>
    request<any>('/database/reset', { method: 'POST' }),

  // Transactions
  listTransactions: (limit = 100) =>
    request<{ transactions: Transaction[]; count: number }>(`/transactions?limit=${limit}`),

  // Manual Operations (Threaded under real synchronization)
  manualRead: (account_id: string) =>
    request<Account>('/operations/read', { method: 'POST', body: JSON.stringify({ account_id }) }),
  manualDeposit: (account_id: string, amount_paise: number) =>
    request<any>('/operations/deposit', { method: 'POST', body: JSON.stringify({ account_id, amount_paise }) }),
  manualWithdraw: (account_id: string, amount_paise: number) =>
    request<any>('/operations/withdraw', { method: 'POST', body: JSON.stringify({ account_id, amount_paise }) }),
  manualTransfer: (source_account: string, destination_account: string, amount_paise: number) =>
    request<any>('/operations/transfer', { method: 'POST', body: JSON.stringify({ source_account, destination_account, amount_paise }) }),

  // Simulation Controls
  startSimulation: (config: SimulationConfig) =>
    request<any>('/simulations', { method: 'POST', body: JSON.stringify(config) }),
  pauseSimulation: () =>
    request<any>('/simulations/pause', { method: 'POST' }),
  resumeSimulation: () =>
    request<any>('/simulations/resume', { method: 'POST' }),
  stopSimulation: () =>
    request<any>('/simulations/stop', { method: 'POST' }),

  // Analytics & History
  listExperiments: () => request<ExperimentRecord[]>('/experiments'),
  getExperiment: (id: string) => request<ExperimentRecord>(`/experiments/${id}`),
  getExperimentEvents: (id: string) => request<{ events: EngineEvent[]; count: number }>(`/experiments/${id}/events`),
  getAnalyticsSummary: () => request<any>('/analytics/summary'),
  getPolicyComparison: () => request<Record<string, any[]>>('/analytics/comparison'),
};
