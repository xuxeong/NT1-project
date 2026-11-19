import hashlib
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch, neolix
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_map_dispatch_app_mission_lifecycle(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch, 'simulator', sim)
    monkeypatch.setattr(neolix, 'simulator', sim)
    monkeypatch.setattr(neolix, 'missions', {})
    monkeypatch.setattr(neolix, 'tokens', {})
    monkeypatch.setenv('MOCK_APP_ID', 'bridge-app')
    monkeypatch.setenv('MOCK_APP_SECRET', 'bridge-secret')
    vin = 'X3S1181'
    prefix = '/openapi-server/slvapi/'
    target = {'vehicle_id': vin, 'kind': 'point',
              'target_lat': 36.7297202, 'target_lng': 127.4423425}
    async with AsyncClient(headers={"X-From": "student-android", "X-Version": "0.0.0"}, transport=ASGITransport(app=app), base_url='http://test') as client:
        token = await client.get('/auth/oauth/token', params={
            'client_id': 'bridge-app', 'client_secret': 'bridge-secret',
            'grant_type': 'client_credentials',
        })
        assert token.status_code == 200
        timestamp, nonce = str(int(time.time())), '42'
        auth = {'timeStamp': timestamp, 'nonce': nonce,
                'access_token': token.json()['access_token'],
                'signature': hashlib.sha1(''.join(sorted([
                    'bridge-secret', timestamp, nonce])).encode('utf-8')).hexdigest()}

        async def post(name, body=None, query=None, status=200):
            url = name if name.startswith('/') else prefix + name
            response = await client.post(url, params={**auth, **(query or {})}, json=body)
            assert response.status_code == status, response.text
            return response.json()

        async def current():
            return (await post('getCurrentMission', {'vin': vin}))['data']

        async def planning():
            return (await post('getPlanningRoute', {'vin': vin}))['data']

        assert (await current()) is None
        preview = await client.post('/api/dispatch/preview', json={
            k: v for k, v in target.items() if k != 'kind'})
        assert preview.status_code == 200
        assert (await current()) is None
        origin = {'lat': sim.vehicles[vin].lat, 'lng': sim.vehicles[vin].lng}
        response = await client.post('/api/dispatch', json=target)
        assert response.status_code == 200
        confirmed = response.json()
        # App planning works even before the first current-mission query.
        route = (await planning())[0]
        assert route['routePath'] == confirmed['path']
        assert route['routePath'][0] == origin
        assert route['routePath'][-1] == confirmed['target']
        endpoints = json.loads(route['route'])
        assert endpoints[0]['latitude'] == origin['lat']
        assert endpoints[-1]['longitude'] == confirmed['target']['lng']
        mission = await current()
        assert mission['missionStatus'] == 1
        assert mission['missionSubId'] == route['routeId']
        assert mission['endStationId'] == endpoints[-1]['stationId']
        assert mission['startStationId'] < 0 and mission['endStationId'] < 0
        assert (await post('listStationByVin/v1', query={'Vin': vin}))['data'] == []
        await post('vehicleCancel', query={'vin': vin}, status=409)
        sim.tick_one_second()
        assert sim.vehicles[vin].lat != origin['lat'] or sim.vehicles[vin].lng != origin['lng']
        assert (await planning())[0]['routePath'] == confirmed['path']
        await post(f'/mock/vehicles/{vin}/pause')
        assert (await current())['missionStatus'] == 2
        paused = sim.vehicles[vin].lat, sim.vehicles[vin].lng
        sim.tick_one_second()
        assert (sim.vehicles[vin].lat, sim.vehicles[vin].lng) == paused
        await post(f'/mock/vehicles/{vin}/resume')
        assert (await current())['missionStatus'] == 1
        # Dashboard stop is visible as cancellation through the app API.
        stopped = await client.post(f'/api/dispatch/{vin}/stop')
        assert stopped.status_code == 200
        assert (await current())['missionStatus'] == 4
        assert await planning() == []

        # A second map dispatch starts at the current position and replaces history.
        response = await client.post('/api/dispatch', json=target)
        assert response.status_code == 200
        second = await current()
        assert second['missionSubId'] != mission['missionSubId']
        assert (await planning())[0]['routePath'][0] == {'lat': paused[0], 'lng': paused[1]}
        await post(f'/mock/vehicles/{vin}/pause')
        await post('vehicleCancel', query={'vin': vin})
        assert (await current())['missionStatus'] == 4
        assert sim.vehicles[vin].task is None
        assert await planning() == []

        # Arrival is retained even if the app did not poll while driving.
        response = await client.post('/api/dispatch', json=target)
        assert response.status_code == 200
        for _ in range(2000):
            sim.tick_one_second()
            if sim.vehicles[vin].task is None:
                break
        assert sim.vehicles[vin].task is None
        assert (await current())['missionStatus'] == 3
        assert await planning() == []
        assert sim.vehicles[vin].lat == response.json()['target']['lat']
        assert sim.vehicles[vin].lng == response.json()['target']['lng']
        assert sim.get_all_stops() == []


@pytest.mark.asyncio
async def test_mission_queries_require_valid_auth(monkeypatch):
    monkeypatch.setattr(neolix, 'tokens', {'valid': time.monotonic() + 3600,
                                         'expired': time.monotonic() - 1})
    monkeypatch.setenv('MOCK_APP_SECRET', 'bridge-secret')
    timestamp, nonce = str(int(time.time())), '42'
    auth = {'timeStamp': timestamp, 'nonce': nonce, 'access_token': 'valid',
            'signature': hashlib.sha1(''.join(sorted([
                'bridge-secret', timestamp, nonce])).encode()).hexdigest()}
    async with AsyncClient(headers={"X-From": "student-android", "X-Version": "0.0.0"}, transport=ASGITransport(app=app), base_url='http://test') as client:
        for endpoint in ['getCurrentMission', 'getPlanningRoute', 'vehicleCancel']:
            for missing in auth:
                response = await client.post('/openapi-server/slvapi/' + endpoint,
                    params={k: v for k, v in auth.items() if k != missing},
                    json={'vin': 'X3S1181'})
                assert response.status_code == 422
            for invalid in [{'nonce': '9'}, {'timeStamp': '123'},
                            {'access_token': 'expired'}, {'signature': 'invalid'}]:
                response = await client.post('/openapi-server/slvapi/' + endpoint,
                    params={**auth, **invalid}, json={'vin': 'X3S1181'})
                assert response.status_code == (422 if 'nonce' in invalid or 'timeStamp' in invalid else 401)
