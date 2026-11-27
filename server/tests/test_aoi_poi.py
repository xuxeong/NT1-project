import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dispatch as dispatch_api
from app.api import routes as routes_api
from app.api import vehicles as vehicles_api
from app.main import app
from app.simulator.vehicle_sim import VehicleSimulator


@pytest.mark.asyncio
async def test_aoi_and_poi_lifecycle_and_dispatch(isolated_simulator_database, monkeypatch):
    sim = VehicleSimulator()
    monkeypatch.setattr(routes_api, "simulator", sim)
    monkeypatch.setattr(dispatch_api, "simulator", sim)
    monkeypatch.setattr(vehicles_api, "simulator", sim)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. 기본 AOI(MOCK_AOI_01: C-Track 오창) 조회 확인
        aois_res = await client.get("/api/aois")
        assert aois_res.status_code == 200
        aois = aois_res.json()
        assert len(aois) == 1
        assert aois[0]["id"] == "MOCK_AOI_01"
        assert aois[0]["name"] == "C-Track 오창"
        assert len(aois[0]["polygon"]) == 4

        # 2. 새 AOI 생성 확인
        create_aoi_res = await client.post(
            "/api/aois",
            json={
                "name": "C-Track 북측 시험구역",
                "color": "#10b981",
                "center_lat": 36.7292,
                "center_lng": 127.4415,
                "radius_m": 140.0,
            },
        )
        assert create_aoi_res.status_code == 200
        new_aoi = create_aoi_res.json()
        assert new_aoi["id"] == "MOCK_AOI_02"
        assert new_aoi["name"] == "C-Track 북측 시험구역"
        assert len(new_aoi["polygon"]) == 4

        # 기본 AOI는 삭제 거부(409), 신규 AOI는 삭제 가능(200)
        assert (await client.delete("/api/aois/MOCK_AOI_01")).status_code == 409
        assert (await client.delete(f"/api/aois/{new_aoi['id']}")).status_code == 200
        assert len((await client.get("/api/aois")).json()) == 1

        # 2-1. 지도에서 직접 찍은 다각형(polygon) 좌표 배열로 커스텀 AOI 생성 확인
        custom_poly = [
            {"lat": 36.7301, "lng": 127.4391},
            {"lat": 36.7302, "lng": 127.4425},
            {"lat": 36.7281, "lng": 127.4428},
            {"lat": 36.7279, "lng": 127.4394},
        ]
        poly_aoi_res = await client.post(
            "/api/aois",
            json={"name": "직접 그린 시험구역", "color": "#f59e0b", "polygon": custom_poly},
        )
        assert poly_aoi_res.status_code == 200
        assert poly_aoi_res.json()["polygon"] == custom_poly

        # 3. 초기 POI(정류장) 목록은 빈 배열(기존 테스트 계약 준수)
        assert (await client.get("/api/stops")).json() == []

        # 4. 지도 Pin 좌표로 POI(거점 지점) 등록 -> 도로 위로 스냅되어 등록되는지 검증
        create_poi_res = await client.post(
            "/api/stops",
            json={"name": "제1시험동 하차장", "lat": 36.7297202, "lng": 127.4423425},
        )
        assert create_poi_res.status_code == 200
        poi = create_poi_res.json()
        assert poi["id"] == "s1"
        assert poi["name"] == "제1시험동 하차장"

        stops_list = (await client.get("/api/stops")).json()
        assert len(stops_list) == 1
        assert stops_list[0]["name"] == "제1시험동 하차장"

        # 5. 등록한 POI 이름으로 좌표 배차 호출 시 target_stop_name과 DB 이력에 반영되는지 확인
        disp_res = await client.post(
            "/api/dispatch",
            json={
                "vehicle_id": "X3S1181",
                "kind": "point",
                "target_name": poi["name"],
                "target_lat": poi["lat"],
                "target_lng": poi["lng"],
            },
        )
        assert disp_res.status_code == 200
        assert "제1시험동 하차장" in disp_res.json()["message"]
        assert sim.get_vehicle("X3S1181").task.target_stop_name == "제1시험동 하차장"

        # 6. 서버 재시작 모사(새 VehicleSimulator 인스턴스 + restore_or_seed_simulator) 시
        #    생성해 둔 AOI 구역과 POI 거점이 DB에서 그대로 복원되는지 검증
        restarted_sim = VehicleSimulator()
        assert restarted_sim.get_all_stops() == []
        isolated_simulator_database.restore_or_seed_simulator(restarted_sim)
        assert len(restarted_sim.get_all_stops()) == 1
        assert restarted_sim.get_all_stops()[0].name == "제1시험동 하차장"
        assert len(restarted_sim.get_all_aois()) == 2
        assert {a.name for a in restarted_sim.get_all_aois()} == {"C-Track 오창", "직접 그린 시험구역"}

        # 복원된 시뮬레이터에 이어서 새 POI를 추가할 때 시퀀스 ID(s2)가 겹치지 않고 증가하는지 확인
        poi2 = restarted_sim.add_stop("물류 하차장 B", 36.7279642, 127.4419241)
        assert poi2.id == "s2"

        # 7. 초기 리셋 시 POI 및 추가 AOI도 DB와 메모리 모두 초기 상태로 복원되는지 확인
        reset_res = await client.post("/api/vehicles/reset")
        assert reset_res.status_code == 200
        assert (await client.get("/api/stops")).json() == []
        assert len((await client.get("/api/aois")).json()) == 1

        after_reset_sim = VehicleSimulator()
        isolated_simulator_database.restore_or_seed_simulator(after_reset_sim)
        assert after_reset_sim.get_all_stops() == []
        assert len(after_reset_sim.get_all_aois()) == 1
