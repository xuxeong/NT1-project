import hashlib
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch, neolix, vehicles
from app.main import app
from app.models.vehicle import OperationStatus, TaskPhase
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_dashboard_and_app_share_fault_and_power_rules(monkeypatch):
    sim = VehicleSimulator()
    for module in (dispatch, neolix, vehicles):
        monkeypatch.setattr(module, 'simulator', sim)
    monkeypatch.setattr(neolix, 'missions', {})
    monkeypatch.setattr(neolix, 'tokens', {'test-token': time.monotonic() + 60})
    monkeypatch.setenv('MOCK_APP_SECRET', 'test-secret')
    timestamp = str(int(time.time()))
    auth = {
        'access_token': 'test-token', 'timeStamp': timestamp, 'nonce': '42',
        'signature': hashlib.sha1(''.join(sorted(['test-secret', timestamp, '42'])).encode()).hexdigest(),
    }
    vin = 'X3S1181'
    v = sim.vehicles[vin]
    payload = {'vehicle_id': vin, 'target_lat': 36.7297202, 'target_lng': 127.4423425}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test',
                           headers={'X-From': 'test'}) as client:
        async def app_post(path, body=None):
            return await client.post(path, params=auth, json=body)

        assert (await client.post('/api/dispatch', json=payload)).status_code == 200
        task = v.task
        path = list(sim._waypoints[vin])
        position = (v.lat, v.lng)
        # Rejected power requests must leave the task and its path intact.
        assert (await client.post(f'/api/vehicles/{vin}/control', json={'power': False})).status_code == 409
        assert (await app_post('/openapi-server/slvapi/powerOnOff', {'vin': vin, 'handleType': 2})).status_code == 409
        assert v.power and v.task is task and sim._waypoints[vin] == path

        assert (await app_post(f'/mock/vehicles/{vin}/fault', {'faultStatus': 1})).status_code == 200
        sim.tick_one_second()
        assert (v.lat, v.lng) == position
        assert v.task.phase == TaskPhase.PAUSED and v.speed_kmh == 0
        assert (await client.post(f'/api/dispatch/{vin}/resume')).status_code == 409
        assert (await app_post(f'/mock/vehicles/{vin}/resume')).status_code == 409
        assert (await client.post('/api/dispatch', json=payload)).status_code == 409
        assert (await app_post(f'/mock/vehicles/{vin}/fault', {'faultStatus': 0})).status_code == 200
        assert v.task.paused  # Clearing a report does not resume automatically.
        assert (await client.post(f'/api/dispatch/{vin}/resume')).status_code == 200
        assert (await client.post(f'/api/dispatch/{vin}/pause')).status_code == 200
        assert (await client.post(f'/api/vehicles/{vin}/control', json={'power': False})).status_code == 200
        assert v.task is None and not v.power
        mission = await app_post('/openapi-server/slvapi/getCurrentMission', {'vin': vin})
        assert mission.json()['data']['missionStatus'] == 4
        assert (await client.post(f'/api/vehicles/{vin}/control', json={'power': True})).status_code == 200
        assert (await client.post(f'/api/dispatch/{vin}/resume')).status_code == 409


@pytest.mark.asyncio
async def test_invalid_control_and_fault_dispatch_preserve_state(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch, 'simulator', sim)
    v = sim.vehicles['X3S1181']
    payload = {'vehicle_id': v.id, 'target_lat': 36.7297202, 'target_lng': 127.4423425}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for action in ('pause', 'resume'):
            assert (await client.post(f'/api/dispatch/missing/{action}')).status_code == 404
            assert (await client.post(f'/api/dispatch/{v.id}/{action}')).status_code == 409
        v.sensors.lidar_ok = False
        assert (await client.post('/api/dispatch', json=payload)).status_code == 409
        assert not v.dispatch_available and v.task is None
        v.sensors.lidar_ok = True
        assert (await client.post('/api/dispatch', json=payload)).status_code == 200
        task = v.task
        task.phase = TaskPhase.ARRIVED
        v.speed_kmh = 0
        for action in ('pause', 'resume'):
            assert (await client.post(f'/api/dispatch/{v.id}/{action}')).status_code == 409
            assert task.phase == TaskPhase.ARRIVED


def test_vehicle_status_lifecycle_and_serialization():
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']

    def status():
        data = v.model_dump(mode='json')
        return data['operation_state'], data['task_status'], data['driving_mode']

    assert status() == ('available', 'idle', 'standby')
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    assert status() == ('driving', 'driving', 'auto')
    assert sim.pause(v.id)
    assert status() == ('waiting', 'paused', 'standby')
    sim.report_fault(v.id, 1)
    assert status() == ('stopped', 'paused', 'standby')
    assert not sim.resume(v.id)
    sim.report_fault(v.id, 0)
    assert status() == ('waiting', 'paused', 'standby')
    assert sim.resume(v.id)
    for _ in range(1000):
        sim.tick_one_second()
        if v.task is None:
            break
    assert status() == ('available', 'completed', 'standby')
    assert not sim.pause(v.id) and not sim.resume(v.id)
    sim.stop(v.id)
    assert v.task_status == 'completed'
    sim.start_dispatch_coordinate(v.id, 36.7279642, 127.4419241)
    sim.stop(v.id)
    assert status() == ('available', 'cancelled', 'standby')
    assert sim.control(v.id, power=False, door_open=None, lights=None)
    assert status() == ('stopped', 'cancelled', 'off')
    assert sim.control(v.id, power=True, door_open=None, lights=None)
    assert status() == ('available', 'cancelled', 'standby')


@pytest.mark.parametrize('blocked_by', ['offline', 'fault', 'suspended'])
def test_blocked_vehicle_pauses_on_tick_without_losing_route(blocked_by):
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    position = v.lat, v.lng
    waypoints = list(sim._waypoints[v.id])
    if blocked_by == 'offline':
        v.online = False
    elif blocked_by == 'fault':
        v.sensors.lidar_ok = False
    else:
        v.operation_status = OperationStatus.SUSPENDED
    sim.tick_one_second()
    assert (v.lat, v.lng) == position
    assert sim._waypoints[v.id] == waypoints
    assert (v.operation_state, v.task_status, v.driving_mode) == ('stopped', 'paused', 'standby')
    assert v.speed_kmh == 0 and v.gear == 'P'
    assert not sim.resume(v.id) and not v.dispatch_available
    v.online = True
    v.sensors.lidar_ok = True
    v.operation_status = OperationStatus.ACTIVE
    assert v.task_status == 'paused'
    assert sim.resume(v.id)


@pytest.mark.asyncio
async def test_invalid_dispatch_and_power_inputs_do_not_change_task(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch, 'simulator', sim)
    monkeypatch.setattr(vehicles, 'simulator', sim)
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    task = v.task
    waypoints = list(sim._waypoints[v.id])
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for body in ({}, {'power': None}, {'power': 'false'}, {'power': 0}):
            response = await client.post(f'/api/vehicles/{v.id}/control', json=body)
            assert response.status_code == 422
        for destination in (
            {}, {'target_lat': 36.7}, {'target_lng': 127.4},
            {'target_lat': 36.7, 'target_lng': 127.4, 'target_stop_id': 's1'},
        ):
            response = await client.post('/api/dispatch', json={'vehicle_id': v.id, **destination})
            assert response.status_code == 422
        assert v.power and v.task is task and sim._waypoints[v.id] == waypoints


def test_direct_dispatch_cannot_overwrite_paused_or_faulted_mission():
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    sim.pause(v.id)
    task = v.task
    waypoints = list(sim._waypoints[v.id])
    with pytest.raises(ValueError):
        sim.start_dispatch_coordinate(v.id, 36.7279642, 127.4419241)
    assert v.task is task and sim._waypoints[v.id] == waypoints
    sim.stop(v.id)
    sim.report_fault(v.id, 1)
    with pytest.raises(ValueError):
        sim.start_dispatch_coordinate(v.id, 36.7279642, 127.4419241)
    assert v.task is None


def test_fault_report_immediately_stops_offline_vehicle_and_validates_input():
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
    waypoints = list(sim._waypoints[v.id])
    v.online = False
    assert sim.report_fault(v.id, 1, '점검 요청')
    assert v.task.paused and v.speed_kmh == 0 and v.gear == 'P'
    assert sim._waypoints[v.id] == waypoints
    for value in (2, -1, True, '1'):
        with pytest.raises(ValueError):
            sim.report_fault(v.id, value)
        assert v.fault_status == 1 and v.fault_reason == '점검 요청'
    assert sim.report_fault(v.id, 0)
    assert v.fault_reason is None and v.task.paused
