import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.engine_bridge.bridge import bridge
from backend.app.storage.history import exp_storage

@pytest_asyncio.fixture(autouse=True)
async def setup_engine():
    await bridge.start()
    yield
    await bridge.stop()

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["status"] == "healthy"
        assert data["data"]["engine_running"] is True

@pytest.mark.asyncio
async def test_accounts_listing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/accounts")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        accounts = data["data"]["accounts"]
        assert len(accounts) >= 5
        # Verify account 1
        acc1 = next((a for a in accounts if a["account_id"] == "ACC001"), None)
        assert acc1 is not None
        assert acc1["holder_name"] == "Customer A"
        assert acc1["balance_paise"] == 1000000

@pytest.mark.asyncio
async def test_single_account_read():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/accounts/ACC001")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["account_id"] == "ACC001"

@pytest.mark.asyncio
async def test_invalid_account_read():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/accounts/ACC_NONEXISTENT")
        assert res.status_code == 404

@pytest.mark.asyncio
async def test_manual_deposit_and_withdrawal():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Deposit ₹1,000 (100,000 paise) to ACC001
        res = await ac.post("/api/operations/deposit", json={"account_id": "ACC001", "amount_paise": 100000})
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Check balance increased
        r_res = await ac.get("/api/accounts/ACC001")
        assert r_res.json()["data"]["balance_paise"] == 1100000

        # Withdraw ₹500 (50,000 paise)
        w_res = await ac.post("/api/operations/withdraw", json={"account_id": "ACC001", "amount_paise": 50000})
        assert w_res.status_code == 200
        assert w_res.json()["success"] is True

        r_res2 = await ac.get("/api/accounts/ACC001")
        assert r_res2.json()["data"]["balance_paise"] == 1050000

@pytest.mark.asyncio
async def test_insufficient_balance_withdrawal():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/operations/withdraw", json={"account_id": "ACC001", "amount_paise": 999999999})
        assert res.status_code == 400
        assert "Insufficient" in res.json()["detail"]

@pytest.mark.asyncio
async def test_atomic_transfer():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/operations/transfer", json={
            "source_account": "ACC001",
            "destination_account": "ACC002",
            "amount_paise": 50000
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

@pytest.mark.asyncio
async def test_engine_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/engine/status")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "metrics" in data["data"]
        assert "sim_state" in data["data"]

@pytest.mark.asyncio
async def test_experiments_history():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/experiments")
        assert res.status_code == 200
        assert res.json()["success"] is True
