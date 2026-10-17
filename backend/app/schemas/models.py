from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

class SyncPolicy(str, Enum):
    READER_PREFERENCE = "READER_PREFERENCE"
    WRITER_PREFERENCE = "WRITER_PREFERENCE"
    FAIR = "FAIR"

class ArrivalPattern(str, Enum):
    BURST = "BURST"
    STAGGERED = "STAGGERED"
    RANDOM = "RANDOM"

class WriterOpType(str, Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAW = "WITHDRAW"
    TRANSFER = "TRANSFER"

class AccountSchema(BaseModel):
    account_id: str
    holder_name: str
    balance_paise: int
    balance_rupees: float
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class AccountCreateRequest(BaseModel):
    account_id: str = Field(..., min_length=3, max_length=32)
    holder_name: str = Field(..., min_length=1, max_length=128)
    balance_paise: int = Field(..., ge=0)

class AccountUpdateRequest(BaseModel):
    holder_name: str = Field(..., min_length=1, max_length=128)

class DepositRequest(BaseModel):
    account_id: str
    amount_paise: int = Field(..., gt=0)

class WithdrawRequest(BaseModel):
    account_id: str
    amount_paise: int = Field(..., gt=0)

class TransferRequest(BaseModel):
    source_account: str
    destination_account: str
    amount_paise: int = Field(..., gt=0)

class ReadAccountRequest(BaseModel):
    account_id: str

class SimulationConfigRequest(BaseModel):
    readers_count: int = Field(5, ge=0, le=50)
    writers_count: int = Field(2, ge=0, le=50)
    policy: SyncPolicy = SyncPolicy.READER_PREFERENCE
    reader_workload_ms: int = Field(800, ge=50, le=5000)
    writer_workload_ms: int = Field(1200, ge=50, le=5000)
    arrival_pattern: ArrivalPattern = ArrivalPattern.BURST
    arrival_interval_ms: int = Field(150, ge=0, le=2000)
    account_id: str = "ACC001"
    writer_op_type: WriterOpType = WriterOpType.DEPOSIT
    seed: Optional[int] = 42

class MetricsSchema(BaseModel):
    active_readers: int = 0
    active_writers: int = 0
    waiting_readers: int = 0
    waiting_writers: int = 0
    completed_readers: int = 0
    completed_writers: int = 0
    failed_operations: int = 0
    cancelled_operations: int = 0
    total_operations: int = 0
    max_simultaneous_readers: int = 0
    sync_violations: int = 0
    avg_reader_wait_ms: float = 0.0
    avg_writer_wait_ms: float = 0.0
    avg_execution_ms: float = 0.0
    min_wait_ms: float = 0.0
    max_wait_ms: float = 0.0

class SimulationStatusResponse(BaseModel):
    experiment_id: str
    sim_state: str
    policy: str
    metrics: MetricsSchema

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    error: Optional[str] = None
