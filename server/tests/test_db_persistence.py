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


def test_simulator_restores_driving_and_paused_missions_across_restart(isolated_db_logger):
    """서버 재시작 시 DB에 저장된 마지막 위치·배터리와 주행 중/일시정지 배차 작업을 그대로 이어받는지 검증합니다."""
    from app.api import neolix as neolix_api

    logger, _ = isolated_db_logger
    sim1 = VehicleSimulator()
    logger.restore_or_seed_simulator(sim1)

    # 1호차: 목적지로 배차 후 주행 시작
    v1 = sim1.vehicles["X3S1181"]
    plan1 = sim1.start_dispatch_coordinate(v1.id, 36.7297202, 127.4423425)
    for _ in range(3):
        sim1.tick_one_second()

    # 2호차: 배차 후 2초 함께 주행 뒤 고장 신고로 일시정지된 상태
    v2 = sim1.vehicles["X3S1182"]
    sim1.start_dispatch_coordinate(v2.id, 36.7279642, 127.4419241)
    for _ in range(2):
        sim1.tick_one_second()
    sim1.report_fault(v2.id, 1, "LiDAR 점검")

    # 서버 종료 직전(5틱 주행 후) 1·2호차 상태 기록
    saved_v1_pos = (v1.lat, v1.lng, v1.battery, v1.task.task_id, v1.task.remaining_distance_m)
    saved_v2_pos = (v2.lat, v2.lng, v2.battery, v2.task.task_id)

    # 새 서버 프로세스 기동 모사 (새로운 VehicleSimulator 인스턴스 생성 후 DB 이어받기)
    neolix_api.missions.clear()
    sim2 = VehicleSimulator()
    actions = logger.restore_or_seed_simulator(sim2)
    assert actions["X3S1181"] == "resumed_driving"
    assert actions["X3S1182"] == "restored_paused"

    r1 = sim2.vehicles["X3S1181"]
    assert (r1.lat, r1.lng, r1.battery) == saved_v1_pos[:3]
    assert r1.task is not None and r1.task.task_id == saved_v1_pos[3]
    assert r1.task_status == "driving" and r1.speed_kmh == 15.0 and r1.gear == "D"
    assert abs(r1.task.remaining_distance_m - saved_v1_pos[4]) < 0.5

    # 이어받은 1호차가 계속 주행하여 목적지에 정상 도착하는지 검증
    for _ in range(1000):
        sim2.tick_one_second()
        if r1.task is None:
            break
    assert r1.task_status == "completed"
    assert (r1.lat, r1.lng) == (plan1["target"]["lat"], plan1["target"]["lng"])

    r2 = sim2.vehicles["X3S1182"]
    assert (r2.lat, r2.lng, r2.battery) == saved_v2_pos[:3]
    assert r2.task is not None and r2.task.task_id == saved_v2_pos[3]
    assert r2.task_status == "paused" and r2.fault_status == 1 and r2.fault_reason == "LiDAR 점검"

    # 다시 재시작했을 때 1호차의 완료(3) 상태도 보존되는지 검증
    sim3 = VehicleSimulator()
    actions3 = logger.restore_or_seed_simulator(sim3)
    assert actions3["X3S1181"] == "restored_completed"
    assert sim3.vehicles["X3S1181"].task_status == "completed"

    # reset_all_state 호출 시 초기 상태로 리셋되는지 검증
    logger.reset_all_state(sim3)
    assert sim3.vehicles["X3S1181"].task_status == "idle"
    assert sim3.vehicles["X3S1182"].fault_status == 0
    assert logger.get_mission_history() == []


@pytest.mark.asyncio
async def test_osm_tile_proxy_and_reset_endpoint(tmp_path, monkeypatch):
    """앱 지도 배경용 OSM 타일 중계·캐시 API 및 상태 초기화(/api/vehicles/reset) API를 검증합니다."""
    import app.main as main_module

    monkeypatch.setattr(main_module, "TILE_CACHE_DIR", tmp_path)
    sample_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    cached_tile = tmp_path / "17" / "111938" / "51162.png"
    cached_tile.parent.mkdir(parents=True, exist_ok=True)
    cached_tile.write_bytes(sample_png)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        tile_res = await client.get("/tiles/17/111938/51162.png")
        assert tile_res.status_code == 200
        assert tile_res.headers["content-type"] == "image/png"
        assert tile_res.content == sample_png

        invalid_tile = await client.get("/tiles/25/-1/0.png")
        assert invalid_tile.status_code == 422

        reset_res = await client.post("/api/vehicles/reset")
        assert reset_res.status_code == 200
        assert reset_res.json()["ok"] is True


