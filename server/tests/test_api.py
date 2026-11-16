import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.simulator.vehicle_sim import simulator


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


@pytest.mark.asyncio
async def test_get_vehicles():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/vehicles")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["id"] == "X3S1181"


@pytest.mark.asyncio
async def test_dispatch_point_and_stop():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. 지점 배차 요청
        dispatch_res = await ac.post("/api/dispatch", json={
            "vehicle_id": "X3S1181",
            "kind": "point",
            "target_stop_id": "s2"
        })
        assert dispatch_res.status_code == 200
        assert dispatch_res.json()["ok"] is True

        # 2. 차량 상태 확인 (주행 중)
        v_res = await ac.get("/api/vehicles/X3S1181")
        assert v_res.status_code == 200
        v_data = v_res.json()
        assert v_data["task"] is not None
        assert v_data["task"]["target_stop_id"] == "s2"
        assert v_data["gear"] == "D"

        # 3. 비상 정차 요청
        stop_res = await ac.post("/api/dispatch/X3S1181/stop")
        assert stop_res.status_code == 200
        assert stop_res.json()["ok"] is True

        # 4. 정차 후 상태 확인
        v_res_after = await ac.get("/api/vehicles/X3S1181")
        assert v_res_after.json()["gear"] == "P"
        assert v_res_after.json()["task"] is None
