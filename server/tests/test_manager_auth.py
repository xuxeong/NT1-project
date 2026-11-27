import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch as dispatch_api
from app.api import neolix as neolix_api
from app.api import vehicles as vehicles_api
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


def _auth_params(token: str):
    import hashlib

    ts = "1700000000"
    nonce = "42"
    sig = hashlib.sha1("".join(sorted(["student-mock-secret", ts, nonce])).encode("utf-8")).hexdigest()
    return {"signature": sig, "timeStamp": ts, "nonce": nonce, "access_token": token}


@pytest.mark.asyncio
async def test_manager_virtual_account_login_vehicle_assignment_and_notifications(
    isolated_simulator_database, monkeypatch
):
    sim = VehicleSimulator()
    monkeypatch.setattr(dispatch_api, "simulator", sim)
    monkeypatch.setattr(vehicles_api, "simulator", sim)
    monkeypatch.setattr(neolix_api, "simulator", sim)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. DB에 사전 적재된 가상 담당자 계정 3개(manager1, manager2, admin) 목록 확인
        mgrs_res = await client.get("/api/managers")
        assert mgrs_res.status_code == 200
        managers = mgrs_res.json()["managers"]
        assert {m["user_id"] for m in managers} == {"manager1", "manager2", "admin"}

        # 2. 담당자 로그인 성공 및 실패 검증 (회원가입 없이 DB 가상 계정 로그인)
        bad_login = await client.post("/api/managers/login", json={"user_id": "manager1", "password": "wrong"})
        assert bad_login.status_code == 401

        login1 = await client.post("/api/managers/login", json={"user_id": "manager1", "password": "1234"})
        assert login1.status_code == 200
        mgr1_data = login1.json()["manager"]
        assert mgr1_data["assigned_vehicle_ids"] == ["X3S1181"]
        assert mgr1_data["phone"] == "010-1111-2222"

        # 3. 담당자 연락처 변경 API 검증
        patch_res = await client.patch(
            "/api/managers/manager1/contact",
            json={"name": "김관제 팀장", "phone": "010-5555-7777"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["manager"]["phone"] == "010-5555-7777"

        # 4. 계정별 할당 차량 조회 필터링 검증 (기존 userId 미전달 시 전체 차량 반환 하위호환 유지)
        all_v = (await client.get("/api/vehicles")).json()
        assert [v["id"] for v in all_v] == ["X3S1181", "X3S1182"]

        m1_v = (await client.get("/api/vehicles", params={"user_id": "manager1"})).json()
        assert [v["id"] for v in m1_v] == ["X3S1181"]

        m2_v = (await client.get("/api/vehicles", params={"user_id": "manager2"})).json()
        assert [v["id"] for v in m2_v] == ["X3S1182"]

        # 학생 앱 공식 API (GET /openapi-server/slvapi/getVehicleList?userId=...) 필터링 연동 확인
        tok_res = await client.get(
            "/auth/oauth/token",
            params={
                "client_id": "student-mock-app",
                "client_secret": "student-mock-secret",
                "grant_type": "client_credentials",
            },
        )
        token = tok_res.json()["access_token"]
        headers = {"X-From": "student-android"}

        app_all = await client.get(
            "/openapi-server/slvapi/getVehicleList",
            params=_auth_params(token),
            headers=headers,
        )
        assert [v["vin"] for v in app_all.json()["data"]] == ["X3S1181", "X3S1182"]

        app_m1 = await client.get(
            "/openapi-server/slvapi/getVehicleList",
            params={**_auth_params(token), "userId": "manager1"},
            headers=headers,
        )
        assert [v["vin"] for v in app_m1.json()["data"]] == ["X3S1181"]

        # 5. 차량 고장 발생(FAULT_REPORT) 및 목적지 도착(ARRIVED) 시 담당자 연락처로 알림이 기록되는지 검증
        sim.start_dispatch_coordinate("X3S1181", 36.7297202, 127.4423425, target_name="제1시험동")
        sim.report_fault("X3S1181", 1, "타이어 공기압 경고")

        fault_notifs = (
            await client.get("/api/managers/notifications", params={"user_id": "manager1"})
        ).json()["notifications"]
        assert len(fault_notifs) == 1
        assert fault_notifs[0]["trigger_type"] == "FAULT_REPORT"
        assert fault_notifs[0]["contact_phone"] == "010-5555-7777"
        assert "타이어 공기압 경고" in fault_notifs[0]["message"]

        # 고장 해제 후 주행 재개 -> 목적지 도착(ARRIVED) 시 도착 알림 발송 확인
        sim.report_fault("X3S1181", 0)
        sim.resume("X3S1181")
        for _ in range(1000):
            sim.tick_one_second()
            if sim.get_vehicle("X3S1181").task is None:
                break

        all_notifs = (
            await client.get("/api/managers/notifications", params={"user_id": "manager1"})
        ).json()["notifications"]
        assert len(all_notifs) == 2
        assert all_notifs[0]["trigger_type"] == "ARRIVED"
        assert "제1시험동" in all_notifs[0]["message"]
        assert all_notifs[0]["contact_phone"] == "010-5555-7777"
