import hashlib
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import neolix
from app.main import app


@pytest.mark.asyncio
async def test_common_headers(monkeypatch):
    monkeypatch.setenv('MOCK_APP_SECRET', 'header-secret')
    monkeypatch.setattr(neolix, 'tokens', {'header-token': time.monotonic() + 3600})
    timestamp, nonce = str(int(time.time())), '42'
    auth = {'access_token': 'header-token', 'timeStamp': timestamp, 'nonce': nonce,
            'signature': hashlib.sha1(''.join(sorted([
                'header-secret', timestamp, nonce])).encode()).hexdigest()}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        for method, path, body in [
            ('GET', '/openapi-server/slvapi/getVehicleList', None),
            ('POST', '/openapi-server/slvapi/getCurrentMission', {'vin': 'X3S1181'}),
            ('POST', '/mock/vehicles/X3S1181/pause', None),
        ]:
            for headers in [{}, {'X-From': ''}, {'X-From': '   '},
                            {'X-From': 'android', 'X-Version': ''},
                            {'X-From': 'android', 'X-Version': '1.2'},
                            {'X-From': 'android', 'X-Version': 'v1.2.3'},
                            {'X-From': 'android', 'X-Version': '1.2.3-beta'}]:
                response = await client.request(method, path, params=auth, headers=headers, json=body)
                assert response.status_code == 422
                assert response.json() == {'code': 'MOCK_INVALID',
                    'msg': '요청 필드 또는 형식 오류', 'data': None}
        for headers in [{'X-From': 'android'},
                        {'x-from': 'android', 'x-version': '1.2.3'},
                        {'X-From': 'android', 'X-Version': '0.0.0'}]:
            response = await client.get('/openapi-server/slvapi/getVehicleList',
                                        params=auth, headers=headers)
            assert response.status_code == 200


def test_openapi_common_headers():
    for path, methods in app.openapi()['paths'].items():
        if not path.startswith(('/openapi-server/slvapi/', '/mock/vehicles/')):
            continue
        for operation in methods.values():
            params = {p['name']: p for p in operation['parameters'] if p['in'] == 'header'}
            assert params['X-From']['required'] is True
            assert params['X-Version']['schema']['default'] == '0.0.0'
            assert params['X-Version']['schema']['pattern'] == r'^[0-9]+\.[0-9]+\.[0-9]+$'
