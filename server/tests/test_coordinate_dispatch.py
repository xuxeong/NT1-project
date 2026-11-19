import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch as dispatch_api
from app.main import app
from app.simulator import road_network
from app.simulator.road_network import distance, path_length, road_path, snap_to_road
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.fixture
def one_way_square(monkeypatch):
    nodes = {
        'a': [36.0, 127.0], 'b': [36.0, 127.001],
        'c': [36.001, 127.001], 'd': [36.001, 127.0],
    }
    graph = {a: {b: distance(nodes[a], nodes[b])}
             for a, b in [('a', 'b'), ('b', 'c'), ('c', 'd'), ('d', 'a')]}
    monkeypatch.setattr(road_network, 'NODES', nodes)
    monkeypatch.setattr(road_network, 'GRAPH', graph)


def test_mid_segment_pin_and_one_way_direction(one_way_square):
    start, target = [36.0, 127.0002], [36.0, 127.0008]
    direct = road_path(start, target)
    assert len(direct) == 2
    assert distance(direct[-1], target) < 0.01
    assert abs(path_length(direct) - distance(start, target)) < 0.01
    # The reverse request must go around the square, not reverse along one-way road.
    reverse = road_path(target, start)
    assert path_length(reverse) > 300
    assert [36.001, 127.001] in reverse
    assert [36.001, 127.0] in reverse


def test_pin_projects_to_segment_without_node_jump(one_way_square):
    snapped = snap_to_road([36.00005, 127.0005])
    assert 5 < snapped['offset_m'] < 6
    assert distance(snapped['point'], [36.0, 127.0005]) < 0.01
    assert snapped['point'] not in road_network.NODES.values()


def test_far_destination_is_snapped_without_dispatching(one_way_square):
    sim = VehicleSimulator()
    vehicle = sim.vehicles['X3S1181']
    vehicle.lat, vehicle.lng = 36.0, 127.0002
    plan = sim.preview_coordinate(vehicle.id, 35.999, 127.0005)
    assert plan['snap_distance_m'] > 40
    assert distance(list(plan['target'].values()), [36.0, 127.0005]) < 0.01
    assert plan['path'][0] == {'lat': vehicle.lat, 'lng': vehicle.lng}
    assert vehicle.task is None
    assert sim.get_all_stops() == []
    # Confirmation uses the latest vehicle position and installs the returned path.
    vehicle.lng = 127.0003
    confirmed = sim.start_dispatch_coordinate(vehicle.id, 35.999, 127.0005)
    assert confirmed['path'][0] == {'lat': vehicle.lat, 'lng': vehicle.lng}
    assert sim._waypoints[vehicle.id] == [
        [p['lat'], p['lng']] for p in confirmed['path'][1:]
    ]


def test_arrival_at_mid_segment_and_next_dispatch(one_way_square):
    sim = VehicleSimulator()
    v = sim.vehicles['X3S1181']
    v.lat, v.lng = 36.0, 127.0002
    first = sim.start_dispatch_coordinate(v.id, 36.0, 127.0008)
    for _ in range(200):
        sim.tick_one_second()
        if v.task is None:
            break
    assert v.task is None and v.speed_kmh == 0
    assert distance((v.lat, v.lng), list(first['target'].values())) < 0.01
    second = sim.start_dispatch_coordinate(v.id, 36.0, 127.0009)
    assert second['distance_m'] < 10  # Continue forward from the segment interior.


@pytest.mark.asyncio
async def test_coordinate_preview_dispatch_and_busy_rejection(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch_api, 'simulator', sim)
    payload = {'vehicle_id': 'X3S1181', 'target_lat': 36.7297202, 'target_lng': 127.4423425}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        preview = await client.post('/api/dispatch/preview', json=payload)
        assert preview.status_code == 200
        plan = preview.json()
        assert plan['path'][-1] == plan['target']
        assert sim.vehicles['X3S1181'].task is None
        result = await client.post('/api/dispatch', json={**payload, 'kind': 'point'})
        assert result.status_code == 200
        assert result.json()['target'] == plan['target']
        assert result.json()['path'] == plan['path']
        task = sim.vehicles['X3S1181'].task
        rejected = await client.post('/api/dispatch', json={**payload, 'kind': 'point'})
        assert rejected.status_code == 409
        assert sim.vehicles['X3S1181'].task is task


@pytest.mark.asyncio
async def test_coordinate_validation_errors(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch_api, 'simulator', sim)
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for payload in [
            {'vehicle_id': 'X3S1181', 'target_lat': 91, 'target_lng': 127},
            {'vehicle_id': 'X3S1181', 'target_lat': 36.729},
        ]:
            response = await client.post('/api/dispatch/preview', json=payload)
            assert response.status_code == 422
        unknown = await client.post('/api/dispatch/preview', json={
            'vehicle_id': 'missing', 'target_lat': 36.7297202, 'target_lng': 127.4423425,
        })
        assert unknown.status_code == 404
