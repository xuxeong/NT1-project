"""충북대학교 C-Track 자율주행 테스트베드 초기 데이터 모듈.

NT1 및 멘토님 미팅을 통해 충북대 C-Track 공식 GeoJSON 또는 고정밀 좌표를
제공받으면 이 모듈의 데이터 리스트만 갱신하면 시뮬레이터에 즉시 반영됩니다.
"""
from typing import Dict, List
from app.models.route import Stop, Route
from app.models.vehicle import VehicleState, ServiceType, OperationStatus, Gear, VehicleLights

# 충북대학교 C-Track (오창 자율주행 테스트베드) 기준 중심 좌표계 (위도: 36.71, 경도: 127.42 대역)
INITIAL_STOPS: List[Stop] = [
    Stop(id="s1", name="C-Track 관제센터 (출발대기소)", lat=36.7121, lng=127.4230, high_precision=True),
    Stop(id="s2", name="C-Track 제1승강장 (직선코스)", lat=36.7135, lng=127.4245, high_precision=True),
    Stop(id="s3", name="C-Track 제2승강장 (도심교차로)", lat=36.7150, lng=127.4238, high_precision=True),
    Stop(id="s4", name="C-Track 제3승강장 (곡선구간)", lat=36.7142, lng=127.4215, high_precision=True),
    Stop(id="s5", name="C-Track 물류하역장 (하역구역)", lat=36.7128, lng=127.4218, high_precision=True),
]

INITIAL_ROUTES: List[Route] = [
    Route(
        id="r1",
        name="C-Track 외곽 순환 본선 코스",
        total_distance_m=1250.0,
        stop_ids=["s1", "s2", "s3", "s4", "s5", "s1"],
        closed_loop=True,
    ),
    Route(
        id="r2",
        name="C-Track 물류 배송 단거리 코스",
        total_distance_m=620.0,
        stop_ids=["s1", "s2", "s5", "s1"],
        closed_loop=True,
    ),
]

INITIAL_VEHICLES: List[VehicleState] = [
    VehicleState(
        id="X3S1181",
        name="Neolix 가상 자율주행 1호차",
        service_type=ServiceType.TRANSPORT,
        aoi="C-Track 오창",
        power=True,
        online=True,
        latency_ms=42,
        operation_status=OperationStatus.ACTIVE,
        lat=36.7121,
        lng=127.4230,
        speed_kmh=0.0,
        gear=Gear.P,
        battery=98.5,
        door_open=False,
        lights=VehicleLights(low=False, high=False, beacon=False, fog=False),
        location_name="C-Track 관제센터 (출발대기소)",
    ),
    VehicleState(
        id="X3S1182",
        name="Neolix 가상 순찰 2호차",
        service_type=ServiceType.PATROL,
        aoi="C-Track 오창",
        power=True,
        online=True,
        latency_ms=48,
        operation_status=OperationStatus.TRIAL,
        lat=36.7150,
        lng=127.4238,
        speed_kmh=0.0,
        gear=Gear.P,
        battery=89.0,
        door_open=False,
        lights=VehicleLights(low=True, high=False, beacon=True, fog=False),
        location_name="C-Track 제2승강장 (도심교차로)",
    ),
]
