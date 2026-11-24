import hashlib
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import neolix
from app.main import app
from app.models.route import Stop
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_mock_app_mission_lifecycle(monkeypatch):
    sim = VehicleSimulator()
    # Legacy station API compatibility uses test-only stations, not default map hubs.
    sim.stops = {
        's1': Stop(id='s1', name='시험 출발점', lat=36.7279642, lng=127.4419241),
        's2': Stop(id='s2', name='시험 도착점', lat=36.7297202, lng=127.4423425),
        's3': Stop(id='s3', name='다른 출발점', lat=36.7277008, lng=127.4443161),
    }
    monkeypatch.setattr(neolix, "simulator", sim)
    monkeypatch.setattr(neolix, "missions", {})
    monkeypatch.setattr(neolix, "tokens", {})
    monkeypatch.setenv("MOCK_APP_ID", "test-app")
    monkeypatch.setenv("MOCK_APP_SECRET", "test-secret")
    prefix = "/openapi-server/slvapi"
    vin = "X3S1181"

    async with AsyncClient(headers={"X-From": "student-android", "X-Version": "0.0.0"}, transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await client.get("/auth/oauth/token", params={
            "client_id": "test-app", "client_secret": "test-secret", "grant_type": "client_credentials",
        })
        assert token.status_code == 200
        assert token.json()["expires_in"] == 3600
        timestamp = str(int(time.time()))
        nonce = "42"
        signature = hashlib.sha1("".join(sorted(["test-secret", timestamp, nonce])).encode()).hexdigest()
        auth = {"timeStamp": timestamp, "nonce": nonce, "signature": signature,
                "access_token": token.json()["access_token"]}

        async def post(path, *, query=None, body=None, expected=200):
            url = path if path.startswith("/mock/") else f"{prefix}/{path}"
            response = await client.post(url, params={**auth, **(query or {})}, json=body)
            assert response.status_code == expected, response.text
            return response.json()

        rejected = await client.get(prefix + "/getVehicleList", params={**auth, "signature": "invalid"})
        assert rejected.status_code == 401
        assert rejected.json()["code"] == "MOCK_AUTH"
        vehicle_list = (await client.get(prefix + "/getVehicleList", params=auth)).json()
        assert vehicle_list["success"] is True
        assert vehicle_list["data"][0]["vin"] == vin
        assert (await post("getCurrentMission", body={"vin": vin}))["data"] is None
        assert (await post("listStationByVin/v1", query={"vin": vin}, expected=422))["code"] == "MOCK_INVALID"
        stations = (await post("listStationByVin/v1", query={"Vin": vin}))["data"]
        assert [station["stationId"] for station in stations[:2]] == [1, 2]
        initial = (await post("getVehicleInfo", query={"vin": vin}))["data"]
        assert initial["speed"] == 0
        assert initial["occurTimestamp"] >= int(timestamp) * 1000
        batch = (await post("batchGetVehicleList", body={"vin": [vin]}))["data"][0]
        assert "parkcode" in batch and "parkCode" not in batch

        body = {"vin": vin, "departureStationId": "1", "destinationStationId": "2",
                "business": "MOCK_PROJECT"}
        await post("vehicleStart/v1", body={**body, "departureStationId": 1}, expected=422)
        await post("vehicleStart/v1", body={**body, "departureStationId": "3"}, expected=409)
        mission_id = (await post("vehicleStart/v1", body=body))["data"]["missionId"]
        await post("vehicleStart/v1", body=body, expected=409)
        current = (await post("getCurrentMission", body={"vin": vin}))["data"]
        assert (current["missionSubId"], current["missionStatus"]) == (mission_id, 1)
        route = (await post("getPlanningRoute", body={"vin": vin}))["data"][0]
        assert len(route["routePath"]) > 2
        assert route["routePath"][0] == {"lat": initial["position"]["lat"], "lng": initial["position"]["lon"]}
        assert json.loads(route["route"])[1]["stationId"] == 2
        await post("vehicleCancel", query={"vin": vin}, expected=409)
        await post("powerOnOff", body={"vin": vin, "handleType": 2}, expected=409)

        await post(f"/mock/vehicles/{vin}/pause")
        sim.tick_one_second()
        stopped = (await post("getVehicleInfo", query={"vin": vin}))["data"]
        assert (stopped["speed"], stopped["gear"], stopped["position"]) == (0, "P", initial["position"])
        assert (await post("getCurrentMission", body={"vin": vin}))["data"]["missionStatus"] == 2
        await post("vehicleCancel", query={"vin": vin})
        assert (await post("getCurrentMission", body={"vin": vin}))["data"]["missionStatus"] == 4
        await post("powerOnOff", body={"vin": vin, "handleType": 2})
        assert (await post("getVehicleInfo", query={"vin": vin}))["data"]["powerState"] is True
        await post("vehicleStart/v1", body=body, expected=409)
        await post("powerOnOff", body={"vin": vin, "handleType": 1})

        assert (await post("vehicleStart/v1", body=body))["data"]["missionId"] != mission_id
        await post(f"/mock/vehicles/{vin}/pause")
        await post(f"/mock/vehicles/{vin}/resume")
        sim.tick_one_second()
        moving_info = (await post("getVehicleInfo", query={"vin": vin}))["data"]
        assert moving_info["position"] != initial["position"]
        assert 0.0 <= moving_info["gnssHead"] < 360.0 and moving_info["gnssHead"] != 0.0
        assert moving_info["mile"] == round(sim.vehicles[vin].battery, 1)

        # 고장 신고 접수 시 주행 중인 차량은 즉시 일시정지되며 faultStatus=1, vehicleAvailable=1이 됩니다.
        fault_res = (await post(f"/mock/vehicles/{vin}/fault", body={"faultStatus": 1, "reason": "LiDAR 센서 점검 요청"}))["data"]
        assert fault_res == {"vin": vin, "faultStatus": 1, "reason": "LiDAR 센서 점검 요청"}
        assert (await post("getCurrentMission", body={"vin": vin}))["data"]["missionStatus"] == 2
        fault_batch = (await post("batchGetVehicleList", body={"vin": [vin]}))["data"][0]
        assert (fault_batch["faultStatus"], fault_batch["vehicleAvailable"]) == (1, 1)
        await post(f"/mock/vehicles/{vin}/resume", expected=409)
        await post(f"/mock/vehicles/{vin}/fault", body={"faultStatus": 0})
        cleared_batch = (await post("batchGetVehicleList", body={"vin": [vin]}))["data"][0]
        assert cleared_batch["faultStatus"] == 0
        await post(f"/mock/vehicles/{vin}/resume")

        for _ in range(100):
            sim.tick_one_second()
        assert (await post("getCurrentMission", body={"vin": vin}))["data"]["missionStatus"] == 3
        assert (await post("getPlanningRoute", body={"vin": vin}))["data"] == []
