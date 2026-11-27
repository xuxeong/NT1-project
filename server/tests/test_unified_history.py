import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.db.database import init_db
from app.db.models import VehicleEventRecord
from app.db.repository import DatabaseLogger
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_unified_history_groups_by_task_and_keeps_unassigned_events(isolated_simulator_database):
    logger = isolated_simulator_database
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.control(v.id, True)  # Event outside any task.
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    first_id = v.task.task_id
    sim.report_fault(v.id, 1, '점검')
    sim.report_fault(v.id, 0)
    sim.resume(v.id)
    sim.pause(v.id)
    sim.control(v.id, False)  # Both CANCEL and POWER_CHANGE belong to the first task.
    sim.control(v.id, True)  # No task; must not attach to the cancelled task.
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    second_id = v.task.task_id
    sim.stop(v.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/vehicles/history', params={'vehicle_id': v.id})
        assert response.status_code == 200
        data = response.json()['vehicles'][0]
        assert data['latest_state']['id'] == v.id
        assert data['latest_state']['battery'] == v.battery
        assert [m['task_id'] for m in data['missions']] == [second_id, first_id]
        newest, oldest = data['missions']
        assert newest['mission_status'] == oldest['mission_status'] == 4
        assert [e['event_type'] for e in newest['events']] == ['DISPATCH_START', 'CANCEL']
        assert all(e['task_id'] == first_id for e in oldest['events'])
        assert {'FAULT_REPORT', 'FAULT_CLEAR', 'PAUSE', 'RESUME', 'CANCEL', 'POWER_CHANGE'} <= {
            e['event_type'] for e in oldest['events']
        }
        assert len(data['unassigned_events']) == 2
        assert all(e['task_id'] is None for e in data['unassigned_events'])
        assert [e['id'] for e in oldest['events']] == sorted(e['id'] for e in oldest['events'])
        assert (await client.get('/api/vehicles/history/missions')).status_code == 200
        assert (await client.get('/api/vehicles/history/events')).status_code == 200


@pytest.mark.asyncio
async def test_unified_history_filters_and_limits_missions_not_task_events(isolated_simulator_database):
    sim = VehicleSimulator()
    for vin in ('X3S1181', 'X3S1182'):
        sim.start_dispatch_coordinate(vin, 36.7297202, 127.4423425)
        sim.pause(vin)
        sim.resume(vin)
        sim.stop(vin)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        data = (await client.get('/api/vehicles/history', params={'vehicle_id': 'X3S1181', 'limit': 1})).json()['vehicles'][0]
        assert len(data['missions']) == 1
        assert data['missions'][0]['vehicle_id'] == 'X3S1181'
        assert len(data['missions'][0]['events']) == 4
        empty = (await client.get('/api/vehicles/history', params={'vehicle_id': 'unknown'})).json()
        assert empty == {'ok': True, 'vehicles': []}
        for value in (0, 201):
            assert (await client.get('/api/vehicles/history', params={'limit': value})).status_code == 422


def test_existing_database_upgrade_preserves_legacy_events(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path / "legacy.sqlite3"}')
    try:
        with engine.begin() as connection:
            connection.execute(text('''CREATE TABLE vehicles (
                id VARCHAR(32) PRIMARY KEY, name VARCHAR(100) NOT NULL,
                aoi VARCHAR(64), power BOOLEAN, online BOOLEAN,
                lat FLOAT NOT NULL, lng FLOAT NOT NULL, heading FLOAT,
                speed_kmh FLOAT, gear VARCHAR(4), battery FLOAT,
                fault_status INTEGER, fault_reason VARCHAR(255), updated_at DATETIME
            )'''))
            connection.execute(text("""INSERT INTO vehicles
                (id, name, aoi, power, online, lat, lng, heading, speed_kmh,
                 gear, battery, fault_status)
                VALUES ('stored-vehicle', '기존 차량', 'C-Track', 1, 1,
                        36.7, 127.4, 0, 0, 'P', 80, 0)"""))
            connection.execute(text('''CREATE TABLE vehicle_event_logs (
                id INTEGER PRIMARY KEY, vehicle_id VARCHAR(32) NOT NULL,
                event_type VARCHAR(40) NOT NULL, lat FLOAT NOT NULL, lng FLOAT NOT NULL,
                battery FLOAT NOT NULL, detail TEXT, created_at DATETIME
            )'''))
            connection.execute(text("""INSERT INTO vehicle_event_logs
                (id, vehicle_id, event_type, lat, lng, battery, detail)
                VALUES (1, 'legacy-vehicle', 'POWER_CHANGE', 36.7, 127.4, 80, '기존 기록')"""))
        init_db(engine)
        init_db(engine)  # Restart must not add the column twice or delete history.
        assert 'task_id' in {c['name'] for c in inspect(engine).get_columns('vehicle_event_logs')}
        assert 'fault_reported_at_ms' in {c['name'] for c in inspect(engine).get_columns('vehicles')}
        logger = DatabaseLogger(session_factory=sessionmaker(bind=engine))
        stored = logger.get_unified_history('stored-vehicle')['vehicles'][0]['latest_state']
        assert stored['name'] == '기존 차량'
        assert stored['battery'] == 80
        assert stored['fault_reported_at_ms'] is None
        data = logger.get_unified_history('legacy-vehicle')['vehicles'][0]
        assert data['latest_state'] is None
        assert data['missions'] == []
        assert data['unassigned_events'][0]['detail'] == '기존 기록'
        assert data['unassigned_events'][0]['task_id'] is None
        with logger.session_factory() as session:
            assert session.query(VehicleEventRecord).count() == 1
    finally:
        engine.dispose()


@pytest.mark.asyncio
async def test_latest_stored_vehicle_state_includes_vehicles_without_missions(isolated_simulator_database):
    logger = isolated_simulator_database
    sim = VehicleSimulator()
    for vehicle in sim.get_all_vehicles():
        logger.sync_vehicle(vehicle)
    stored = sim.vehicles['X3S1182']
    stored.power = False
    stored.online = False
    stored.battery = 42.5
    stored.fault_status = 1
    stored.fault_reason = '센서 점검'
    stored.fault_reported_at_ms = 1795672800000
    logger.sync_vehicle(stored)
    stored.battery = 10.0  # In-memory changes must not replace the stored snapshot in history.
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/api/vehicles/history')
        assert response.status_code == 200
        vehicles = response.json()['vehicles']
        assert [v['vehicle_id'] for v in vehicles] == ['X3S1181', 'X3S1182']
        assert all(v['missions'] == [] and v['unassigned_events'] == [] for v in vehicles)
        state = vehicles[1]['latest_state']
        assert state['battery'] == 42.5
        assert state['fault_status'] == 1
        assert state['fault_reason'] == '센서 점검'
        assert state['fault_reported_at_ms'] == 1795672800000
        assert state['power'] is False and state['online'] is False
        assert state['updated_at'] is not None
        filtered = (await client.get('/api/vehicles/history', params={'vehicle_id': stored.id})).json()
        assert len(filtered['vehicles']) == 1
        assert filtered['vehicles'][0]['vehicle_id'] == stored.id
