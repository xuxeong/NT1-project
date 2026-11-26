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
from app.models.vehicle import OperationStatus


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


@pytest.mark.parametrize('cause', ['report', 'offline', 'sensor', 'suspended'])
def test_automatic_pause_updates_mission_and_preserves_route(isolated_db_logger, cause):
    logger, sessions = isolated_db_logger
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    task_id = v.task.task_id
    path = list(sim._waypoints[v.id])
    if cause == 'report':
        # Report safety-stop must work even if the user pause command is unavailable.
        v.online = False
        sim.report_fault(v.id, 1, '점검')
    else:
        if cause == 'offline':
            v.online = False
        elif cause == 'sensor':
            v.sensors.camera_ok = False
        else:
            v.operation_status = OperationStatus.SUSPENDED
        sim.tick_one_second()
    with sessions() as db:
        mission = db.query(MissionRecord).filter_by(task_id=task_id).one()
        assert mission.mission_status == 2
        assert db.query(VehicleEventRecord).filter_by(event_type='PAUSE').count() == 1
    assert v.task_status == 'paused' and sim._waypoints[v.id] == path
    # Another tick or a rejected user command must not duplicate the pause event.
    sim.tick_one_second()
    assert not sim.pause(v.id)
    with sessions() as db:
        assert db.query(VehicleEventRecord).filter_by(event_type='PAUSE').count() == 1


def test_completed_mission_not_cancelled_by_repeated_stop_or_power_off(isolated_db_logger):
    logger, sessions = isolated_db_logger
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, v.lat, v.lng)
    sim.tick_one_second()
    assert v.task_status == 'completed'
    sim.stop(v.id)
    sim.control(v.id, power=False)
    sim.stop(v.id)
    with sessions() as db:
        assert db.query(MissionRecord).one().mission_status == 3
        assert db.query(VehicleEventRecord).filter_by(event_type='CANCEL').count() == 0
    assert v.task_status == 'completed'


def test_cancel_records_only_current_task_once(isolated_db_logger):
    logger, sessions = isolated_db_logger
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.stop(v.id)  # No mission must not create a cancellation.
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    sim.pause(v.id)
    sim.control(v.id, power=False)
    sim.stop(v.id)
    with sessions() as db:
        assert db.query(MissionRecord).one().mission_status == 4
        assert db.query(VehicleEventRecord).filter_by(event_type='CANCEL').count() == 1


def test_driving_tick_updates_latest_vehicle_snapshot(isolated_db_logger):
    logger, sessions = isolated_db_logger
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    start = v.lat, v.lng
    sim.tick_one_second()
    assert (v.lat, v.lng) != start
    with sessions() as db:
        row = db.query(VehicleRecord).filter_by(id=v.id).one()
        assert (row.lat, row.lng, row.battery, row.heading) == (v.lat, v.lng, v.battery, v.heading)


def test_history_survives_database_reconnection(tmp_path, monkeypatch):
    url = f'sqlite:///{tmp_path / "history.sqlite3"}'
    first_engine = create_engine(url)
    logger = DatabaseLogger(session_factory=sessionmaker(bind=first_engine))
    monkeypatch.setattr(repo_module, 'db_logger', logger)
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    try:
        sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
        task_id = v.task.task_id
        sim.pause(v.id)
        sim.stop(v.id)
    finally:
        first_engine.dispose()
    reopened_engine = create_engine(url)
    try:
        reopened = DatabaseLogger(session_factory=sessionmaker(bind=reopened_engine))
        records = reopened.get_mission_history(v.id)
        assert len(records) == 1
        assert records[0]['task_id'] == task_id and records[0]['mission_status'] == 4
        assert {row['event_type'] for row in reopened.get_event_history(v.id)} == {
            'DISPATCH_START', 'PAUSE', 'CANCEL',
        }
    finally:
        reopened_engine.dispose()
