import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_restored_mission_route_is_available_to_a_new_dashboard(
    isolated_simulator_database, monkeypatch,
):
    logger = isolated_simulator_database
    original = VehicleSimulator()
    vehicle_id = "X3S1181"
    plan = original.start_dispatch_coordinate(vehicle_id, 36.7297202, 127.4423425)
    original.pause(vehicle_id)
    task_id = original.get_vehicle(vehicle_id).task.task_id

    restored = VehicleSimulator()
    logger.restore_or_seed_simulator(restored)
    monkeypatch.setattr(dispatch, "simulator", restored)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/dispatch/{vehicle_id}/route")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["path"] == restored.coordinate_missions[vehicle_id]["path"]
        assert len(data["path"]) >= 2
        assert data["path"][-1] == plan["path"][-1]
        assert restored.get_vehicle(vehicle_id).task.paused is True

        restored.stop(vehicle_id)
        # The server retains mission snapshots, but cancelled work must not be drawn.
        assert vehicle_id in restored.coordinate_missions
        empty = (await client.get(f"/api/dispatch/{vehicle_id}/route")).json()
        assert empty == {"vehicle_id": vehicle_id, "task_id": None, "path": []}


@pytest.mark.asyncio
async def test_route_lookup_handles_idle_and_unknown_vehicles(monkeypatch):
    monkeypatch.setattr(dispatch, "simulator", VehicleSimulator())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        idle = await client.get("/api/dispatch/X3S1181/route")
        assert idle.status_code == 200
        assert idle.json() == {"vehicle_id": "X3S1181", "task_id": None, "path": []}
        assert (await client.get("/api/dispatch/unknown/route")).status_code == 404
