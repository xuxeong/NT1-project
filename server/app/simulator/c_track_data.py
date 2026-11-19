"""충북대학교 C-Track 자율주행 테스트베드 초기 데이터 모듈.

고정 거점과 사전 정의 코스 없이 차량 초기 좌표를 제공합니다.
목적지 이동은 OSM 도로망에서 좌표 경로를 계산합니다.
"""
from typing import List
from app.models.route import Stop, Route
from app.models.vehicle import VehicleState, ServiceType, OperationStatus, Gear, VehicleLights

# 고정 거점은 사용하지 않습니다. 기존 지점 API용 저장소는 빈 상태로 시작합니다.

INITIAL_STOPS: List[Stop] = []

# 기업 제공 공식 코스가 없어 사전 정의 코스는 등록하지 않습니다.
INITIAL_ROUTES: List[Route] = []

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
        lat=36.7279642,
        lng=127.4419241,
        speed_kmh=0.0,
        gear=Gear.P,
        battery=98.5,
        door_open=False,
        lights=VehicleLights(low=False, high=False, beacon=False, fog=False),
        location_name="초기 위치",
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
        lat=36.729597,
        lng=127.4395988,
        speed_kmh=0.0,
        gear=Gear.P,
        battery=89.0,
        door_open=False,
        lights=VehicleLights(low=True, high=False, beacon=True, fog=False),
        location_name="초기 위치",
    ),
]
