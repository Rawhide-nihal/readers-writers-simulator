export type SyncPolicy = 'READER_PREFERENCE' | 'WRITER_PREFERENCE' | 'FAIR';
export type ArrivalPattern = 'BURST' | 'STAGGERED' | 'RANDOM';
export type WriterOpType = 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
export type SimState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface Account {
  account_id: string;
  holder_name: string;
  balance_paise: number;
  balance_rupees: number;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  transaction_id: string;
  transaction_type: string;
  source_account?: string;
  destination_account?: string;
  amount_paise: number;
  amount_rupees: number;
  operation_id?: string;
  status: string;
  details?: string;
  created_at: string;
}

export interface Metrics {
  active_readers: number;
  active_writers: number;
  waiting_readers: number;
  waiting_writers: number;
  completed_readers: number;
  completed_writers: number;
  failed_operations: number;
  cancelled_operations: number;
  total_operations: number;
  max_simultaneous_readers: number;
  sync_violations: number;
  avg_reader_wait_ms: number;
  avg_writer_wait_ms: number;
  avg_execution_ms: number;
  min_wait_ms: number;
  max_wait_ms: number;
}

export interface EngineStatus {
  experiment_id: string;
  sim_state: SimState;
  policy: SyncPolicy;
  metrics: Metrics;
  accounts?: Account[];
}

export interface EngineEvent {
  seq: number;
  timestamp_ms: number;
  monotonic_ms: number;
  exp_id: string;
  op_id: string;
  role: 'READER' | 'WRITER' | 'SYSTEM';
  event: string;
  state: 'CREATED' | 'QUEUED' | 'WAITING' | 'ACQUIRED' | 'READING' | 'WRITING' | 'RELEASING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE';
  account_id: string;
  policy: SyncPolicy;
  metrics: {
    active_readers: number;
    active_writers: number;
    waiting_readers: number;
    waiting_writers: number;
  };
  details?: any;
}

export interface ThreadNode {
  op_id: string;
  role: 'READER' | 'WRITER';
  state: string;
  account_id: string;
  arrival_time_ms?: number;
  acquired_time_ms?: number;
  release_time_ms?: number;
  wait_duration_ms?: number;
  execution_duration_ms?: number;
  details?: any;
  last_event_time: number;
}

export interface SimulationConfig {
  readers_count: number;
  writers_count: number;
  policy: SyncPolicy;
  reader_workload_ms: number;
  writer_workload_ms: number;
  arrival_pattern: ArrivalPattern;
  arrival_interval_ms: number;
  account_id: string;
  writer_op_type: WriterOpType;
  seed: number;
}

export interface ExperimentRecord {
  experiment_id: string;
  policy: SyncPolicy;
  status: string;
  created_at: string;
  duration_seconds: number;
  config: SimulationConfig;
  metrics: Metrics;
  event_count: number;
}
