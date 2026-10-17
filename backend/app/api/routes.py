from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional
from ..engine_bridge.bridge import bridge
from ..storage.history import exp_storage
from ..websocket.manager import ws_manager
from ..schemas.models import (
    AccountCreateRequest,
    AccountUpdateRequest,
    DepositRequest,
    WithdrawRequest,
    TransferRequest,
    ReadAccountRequest,
    SimulationConfigRequest,
    ApiResponse
)

router = APIRouter(prefix="/api")

# --- Health & Engine Status ---

@router.get("/health", response_model=ApiResponse)
async def health_check():
    engine_active = bridge.is_running and bridge.process is not None and bridge.process.returncode is None
    return ApiResponse(
        success=True,
        data={
            "status": "healthy",
            "engine_running": engine_active,
            "project": "SyncDB Lab (Group G-15)",
            "os_environment": "Ubuntu Linux"
        }
    )

@router.get("/engine/status", response_model=ApiResponse)
async def get_engine_status():
    try:
        resp = await bridge.send_command("status")
        return ApiResponse(success=resp.get("success", False), data=resp.get("data"), error=resp.get("error"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"C Engine unavailable: {e}")

@router.get("/simulations/current", response_model=ApiResponse)
async def get_current_simulation():
    try:
        resp = await bridge.send_command("snapshot")
        return ApiResponse(success=resp.get("success", False), data=resp.get("data"), error=resp.get("error"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"C Engine error: {e}")

# --- Database Endpoints ---

@router.get("/accounts", response_model=ApiResponse)
async def list_accounts():
    try:
        resp = await bridge.send_command("list_accounts")
        return ApiResponse(success=resp.get("success", False), data=resp.get("data"), error=resp.get("error"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database list failed: {e}")

@router.get("/accounts/{account_id}", response_model=ApiResponse)
async def get_account(account_id: str):
    try:
        resp = await bridge.send_command("read_account", {"account_id": account_id})
        if not resp.get("success"):
            raise HTTPException(status_code=404, detail=resp.get("error", "Account not found"))
        return ApiResponse(success=True, data=resp.get("data"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/accounts", response_model=ApiResponse)
async def create_account(req: AccountCreateRequest):
    try:
        resp = await bridge.send_command("create_account", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Create account failed"))
        return ApiResponse(success=True, data=resp.get("data"), message="Account created")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/accounts/{account_id}", response_model=ApiResponse)
async def update_account(account_id: str, req: AccountUpdateRequest):
    try:
        payload = {"account_id": account_id, "holder_name": req.holder_name}
        resp = await bridge.send_command("update_account", payload)
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Update account failed"))
        return ApiResponse(success=True, data=resp.get("data"), message="Account updated")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/accounts/{account_id}", response_model=ApiResponse)
async def delete_account(account_id: str):
    try:
        resp = await bridge.send_command("delete_account", {"account_id": account_id})
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Delete account failed"))
        return ApiResponse(success=True, data=resp.get("data"), message="Account deleted")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/database/reset", response_model=ApiResponse)
async def reset_database():
    try:
        resp = await bridge.send_command("reset_database")
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Reset failed"))
        return ApiResponse(success=True, message="Database reset to sample seed data")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/transactions", response_model=ApiResponse)
async def list_transactions(limit: int = Query(50, ge=1, le=500)):
    try:
        resp = await bridge.send_command("list_transactions", {"limit": limit})
        return ApiResponse(success=resp.get("success", False), data=resp.get("data"), error=resp.get("error"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Manual Operations (Protected by Readers-Writers Synchronization) ---

@router.post("/operations/read", response_model=ApiResponse)
async def manual_read(req: ReadAccountRequest):
    try:
        resp = await bridge.send_command("read_account", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=404, detail=resp.get("error", "Read failed"))
        return ApiResponse(success=True, data=resp.get("data"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/operations/deposit", response_model=ApiResponse)
async def manual_deposit(req: DepositRequest):
    try:
        resp = await bridge.send_command("deposit", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Deposit failed"))
        return ApiResponse(success=True, message=resp.get("data", {}).get("message", "Deposit committed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/operations/withdraw", response_model=ApiResponse)
async def manual_withdraw(req: WithdrawRequest):
    try:
        resp = await bridge.send_command("withdraw", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Withdrawal failed"))
        return ApiResponse(success=True, message=resp.get("data", {}).get("message", "Withdrawal committed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/operations/transfer", response_model=ApiResponse)
async def manual_transfer(req: TransferRequest):
    try:
        resp = await bridge.send_command("transfer", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Transfer failed"))
        return ApiResponse(success=True, message=resp.get("data", {}).get("message", "Transfer committed atomically"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Simulation Controls ---

@router.post("/simulations", response_model=ApiResponse)
async def start_simulation(req: SimulationConfigRequest):
    try:
        resp = await bridge.send_command("start_simulation", req.model_dump())
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Start simulation failed"))
        
        # Track in history
        exp_id = resp.get("data", {}).get("experiment_id", "")
        if exp_id:
            exp_storage.create_experiment(exp_id, req.policy.value, req.model_dump())

        return ApiResponse(success=True, data=resp.get("data"), message="Simulation started")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulations/pause", response_model=ApiResponse)
async def pause_simulation():
    try:
        resp = await bridge.send_command("pause_simulation")
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Pause failed"))
        return ApiResponse(success=True, message="Simulation paused")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulations/resume", response_model=ApiResponse)
async def resume_simulation():
    try:
        resp = await bridge.send_command("resume_simulation")
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Resume failed"))
        return ApiResponse(success=True, message="Simulation resumed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulations/stop", response_model=ApiResponse)
async def stop_simulation():
    try:
        resp = await bridge.send_command("stop_simulation")
        if not resp.get("success"):
            raise HTTPException(status_code=400, detail=resp.get("error", "Stop failed"))
        return ApiResponse(success=True, message="Simulation stopped cleanly")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- History & Analytics ---

@router.get("/experiments", response_model=ApiResponse)
async def list_experiments():
    return ApiResponse(success=True, data=exp_storage.list_experiments())

@router.get("/experiments/{experiment_id}", response_model=ApiResponse)
async def get_experiment(experiment_id: str):
    exp = exp_storage.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ApiResponse(success=True, data=exp.to_dict())

@router.get("/experiments/{experiment_id}/events", response_model=ApiResponse)
async def get_experiment_events(experiment_id: str):
    exp = exp_storage.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ApiResponse(success=True, data={"events": exp.events, "count": len(exp.events)})

@router.get("/analytics/summary", response_model=ApiResponse)
async def get_analytics_summary():
    # Return authoritative engine metrics + historical aggregate
    try:
        status_resp = await bridge.send_command("status")
        current_metrics = status_resp.get("data", {}).get("metrics", {})
    except Exception:
        current_metrics = {}

    return ApiResponse(
        success=True,
        data={
            "current_metrics": current_metrics,
            "total_experiments_recorded": len(exp_storage.order),
            "recent_events": ws_manager.get_recent_events(limit=100)
        }
    )

@router.get("/analytics/comparison", response_model=ApiResponse)
async def get_policy_comparison():
    return ApiResponse(success=True, data=exp_storage.get_comparison())
