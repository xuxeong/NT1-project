"""SQLAlchemy ORM persistence tests for vehicles, missions, and audit event logs."""
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import dispatch as dispatch_api
from app.api import vehicles as vehicles_api
from app.db import repository as repo_module
from app.db.database import Base
from app.db.models import MissionRecord, VehicleEventRecord, VehicleRecord
from app.db.repository import DatabaseLogger
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.fixture
def isolated_db_logger(monkeypatch):
    """In-memory SQLite engine shared across threads/sessions for fast isolated testing."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    logger = DatabaseLogger(session_factory=TestSession)
    logger._initialized = True
    monkeypatch.setattr(repo_module, "db_logger", logger)
    monkeypatch.setattr(vehicles_api, "db_logger", logger)
    return logger, TestSession


@pytest.mark.asyncio
async def test_sqlalchemy_mission_and_event_persistence(isolated_db_logger, monkeypatch):
    logger, TestSession = isolated_db_logger
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch_api, "simulator", sim)
    monkeypatch.setattr(vehicles_api, "simulator", sim)

    vin = "X3S1181"
    for v in sim.get_all_vehicles():
        logger.sync_vehicle(v)

    with TestSession() as db:
        assert db.query(VehicleRecord).count() == 2

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. 지도 좌표 배차 시작 -> DB mission_logs (status=1) & DISPATCH_START 이벤트 적재 확인
        res = await client.post(
            "/api/dispatch",
            json={"vehicle_id": vin, "kind": "point", "target_lat": 36.7297202, "target_lng": 127.4423425},
        )
        assert res.status_code == 200

        missions_res = (await client.get(f"/api/vehicles/history/missions?vehicle_id={vin}")).json()
        assert len(missions_res["missions"]) == 1
        assert missions_res["missions"][0]["mission_status"] == 1

        # 2. 일시정지 -> DB mission_status=2 & PAUSE 이벤트 적재 확인
        sim.pause(vin)
        missions_res = (await client.get(f"/api/vehicles/history/missions?vehicle_id={vin}")).json()
        assert missions_res["missions"][0]["mission_status"] == 2

        # 3. 주행 재개 -> DB mission_status=1 & RESUME 이벤트 적재 확인
        sim.resume(vin)
        missions_res = (await client.get(f"/api/vehicles/history/missions?vehicle_id={vin}")).json()
        assert missions_res["missions"][0]["mission_status"] == 1

        # 4. 고장 신고 및 해제 -> FAULT_REPORT(자동 일시정지 포함), FAULT_CLEAR 적재 확인
        sim.report_fault(vin, 1, "카메라 센서 지연")
        with TestSession() as db:
            v_row = db.query(VehicleRecord).filter(VehicleRecord.id == vin).first()
            assert v_row.fault_status == 1
            assert v_row.fault_reason == "카메라 센서 지연"

        sim.report_fault(vin, 0)
        sim.resume(vin)

        # 5. 주행 완료(도착)까지 시뮬레이션 틱 진행 -> DB mission_status=3 & ARRIVED 이벤트 확인
        for _ in range(1000):
            sim.tick_one_second()
            if sim.vehicles[vin].task is None:
                break

        missions_res = (await client.get(f"/api/vehicles/history/missions?vehicle_id={vin}")).json()
        assert missions_res["missions"][0]["mission_status"] == 3

        events_res = (await client.get(f"/api/vehicles/history/events?vehicle_id={vin}")).json()
        event_types = [e["event_type"] for e in events_res["events"]]
        for expected_type in ["DISPATCH_START", "PAUSE", "RESUME", "FAULT_REPORT", "FAULT_CLEAR", "ARRIVED"]:
            assert expected_type in event_types

        with TestSession() as db:
            assert db.query(MissionRecord).count() == 1
            assert db.query(VehicleEventRecord).count() >= 6
