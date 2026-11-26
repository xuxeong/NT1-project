import hashlib
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import neolix, vehicles
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_vehicle_information_agrees_across_rest_and_student_api(monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(vehicles, 'simulator', sim)
    monkeypatch.setattr(neolix, 'simulator', sim)
    monkeypatch.setenv('MOCK_APP_SECRET', 'info-secret')
    monkeypatch.setattr(neolix, 'tokens', {'info-token': time.monotonic() + 60})
    timestamp = str(int(time.time()))
    auth = {'access_token': 'info-token', 'timeStamp': timestamp, 'nonce': '42',
            'signature': hashlib.sha1(''.join(sorted(['info-secret', timestamp, '42'])).encode()).hexdigest()}
    v = sim.vehicles['X3S1181']
    # A non-default range catches accidental use of battery percentage as km.
    v.specifications.full_charge_range_km = 160
    v.battery = 42.25
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test',
                           headers={'X-From': 'test'}) as client:
        async def check():
            detail_response = await client.get(f'/api/vehicles/{v.id}')
            info_response = await client.post('/openapi-server/slvapi/getVehicleInfo',
                                              params={**auth, 'vin': v.id})
            batch_response = await client.post('/openapi-server/slvapi/batchGetVehicleList',
                                               params=auth, json={'vin': [v.id]})
            assert detail_response.status_code == info_response.status_code == batch_response.status_code == 200
            detail = detail_response.json()
            info = info_response.json()['data']
            batch = batch_response.json()['data'][0]
            assert detail['id'] == info['vin'] == batch['vin'] == v.id
            assert detail['aoi'] == info['parkName'] == batch['parkname']
            assert detail['remaining_range_km'] == info['mile'] == batch['mile']
            assert info['mile'] == round(160 * v.battery / 100, 1)
            assert info['realBattery'] == round(detail['battery'])
            assert info['speed'] == detail['speed_kmh']
            assert info['gear'] == detail['gear']
            assert info['position'] == {'lat': detail['lat'], 'lon': detail['lng']}
            assert info['gnssHead'] == detail['heading']
            assert detail['sensors'] == v.sensors.model_dump()
            return detail

        assert (await check())['remaining_range_km'] == 67.6
        sim.start_dispatch_coordinate(v.id, 36.7297202, 127.4423425)
        before = v.battery
        sim.tick_one_second()
        assert v.battery < before
        assert v.location_name == f'{v.lat:.6f}, {v.lng:.6f}'
        await check()
        sim.pause(v.id)
        battery, heading = v.battery, v.heading
        sim.tick_one_second()
        assert (v.battery, v.heading) == (battery, heading)
        await check()


@pytest.mark.parametrize('power,online,expected', [
    (True, True, True), (False, True, False), (True, False, False), (False, False, False),
])
def test_sensor_availability_and_telemetry_serialization(power, online, expected):
    v = VehicleSimulator().vehicles['X3S1181']
    v.power, v.online = power, online
    payload = v.model_dump(mode='json')
    assert payload['sensors_available'] is expected
    assert payload['remaining_range_km'] == v.remaining_range_km
    assert 'sensors' in payload and 'specifications' in payload


@pytest.mark.parametrize('battery,expected', [(0, 0.0), (50, 80.0), (100, 160.0)])
def test_estimated_range_boundaries(battery, expected):
    v = VehicleSimulator().vehicles['X3S1181']
    v.specifications.full_charge_range_km = 160
    v.battery = battery
    assert v.remaining_range_km == expected
