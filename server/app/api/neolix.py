"""Student-facing Mock API backed by the existing virtual vehicle simulator."""

import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from itertools import count
from os import getenv
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field, StrictInt

from app.models.neolix import (
    MockResponse, FlaggedResponse, TokenResponse, VehicleListItem, VehicleInfo,
    BatchVehicleInfo, StationInfo, MissionCreated, CurrentMission, PlanningRoute,
    FaultReportStatus, AUTH_ERRORS, VEHICLE_ERRORS, CONTROL_ERRORS,
)
from app.models.route import Stop
from app.models.vehicle import TaskPhase, VehicleState, VehicleTask
from app.simulator.vehicle_sim import haversine_distance_m, simulator
from app.simulator.road_network import path_length, road_path

PREFIX = "/openapi-server/slvapi"
TOKEN_TTL = 3600
tokens: dict[str, float] = {}
mission_ids = count(1)


class MockError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


class MockRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request: Request):
            try:
                return await handler(request)
            except MockError as error:
                return JSONResponse(
                    status_code=error.status,
                    content={"code": error.code, "msg": error.message, "data": None},
                )
            except RequestValidationError:
                return JSONResponse(
                    status_code=422,
                    content={"code": "MOCK_INVALID", "msg": "요청 필드 또는 형식 오류", "data": None},
                )

        return handle


router = APIRouter(route_class=MockRoute, tags=["학생 앱 Mock API"])


def success(data, *, include_flag: bool = False):
    result = {"code": "10000", "msg": "성공", "data": data}
    if include_flag:
        result["success"] = True
    return result


def secret() -> str:
    return getenv("MOCK_APP_SECRET", "student-mock-secret")


@router.get("/auth/oauth/token", response_model=TokenResponse, responses=AUTH_ERRORS,
            summary="시험 앱 토큰 발급", description="client_id와 client_secret은 서버의 MOCK_APP_ID/MOCK_APP_SECRET 설정값입니다. 기본값은 student-mock-app / student-mock-secret입니다.")
async def issue_token(client_id: str, client_secret: str, grant_type: Literal["client_credentials"]):
    if client_id != getenv("MOCK_APP_ID", "student-mock-app") or client_secret != secret():
        raise MockError(401, "MOCK_AUTH", "Mock 인증 실패")
    now = time.monotonic()
    for expired in [token for token, expiry in tokens.items() if expiry <= now]:
        del tokens[expired]
    token = secrets.token_urlsafe(24)
    tokens[token] = now + TOKEN_TTL
    return JSONResponse(
        content={"access_token": token, "token_type": "bearer", "expires_in": TOKEN_TTL, "scope": "all"},
        headers={"Cache-Control": "no-store"},
    )


async def authenticate(
    signature: Annotated[str, Query(description="Secret·timeStamp·nonce를 문자열 사전순 정렬 후 구분자 없이 연결하고 UTF-8 SHA-1 소문자 hex로 변환합니다.")],
    timeStamp: Annotated[str, Query(pattern=r"^[0-9]{10}$", description="Unix 시각 초 단위 10자리 문자열")],
    nonce: Annotated[str, Query(pattern=r"^[1-9][0-9]$", description="10~99 두 자리 정수 문자열")],
    access_token: Annotated[str, Query(description="GET /auth/oauth/token에서 발급받은 토큰")],
    x_from: Annotated[str, Header(alias="X-From", pattern=r".*\S.*", description="호출 주체 식별자. 팀에서 정한 비어 있지 않은 값을 사용합니다.", examples=["student-android"])],
    x_version: Annotated[str, Header(alias="X-Version", pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$", description="호출 앱 버전 A.B.C. 생략하면 0.0.0입니다.", examples=["0.0.0"])] = "0.0.0",
):
    expected = hashlib.sha1("".join(sorted([secret(), timeStamp, nonce])).encode("utf-8")).hexdigest()
    if tokens.get(access_token, 0) <= time.monotonic() or signature != expected:
        raise MockError(401, "MOCK_AUTH", "Mock 인증 실패")


api = APIRouter(prefix=PREFIX, dependencies=[Depends(authenticate)], route_class=MockRoute)


class VehicleRequest(BaseModel):
    vin: str


class StartRequest(VehicleRequest):
    departureStationId: str
    destinationStationId: str
    business: Annotated[str, Field(min_length=1)]
    backUrl: str | None = None


class PowerRequest(VehicleRequest):
    handleType: StrictInt


class BatchRequest(BaseModel):
    vin: list[str]


class FaultReportRequest(BaseModel):
    faultStatus: StrictInt = Field(1, description="1: 고장 신고 접수(이상), 0: 고장 해제(정상)")
    reason: str | None = Field(None, description="고장 신고 사유 또는 증상 메모")


@dataclass
class Mission:
    id: int
    departure: Stop
    destination: Stop
    task: VehicleTask
    path: list[dict[str, float]] | None = None


missions: dict[str, Mission] = {}


def resolve_mission(vin: str) -> Mission | None:
    """Expose map dispatches through the existing app mission contract.

    Negative endpoint IDs belong only to this mission, never the station list.
    The simulator snapshot remains available after arrival or cancellation.
    """
    record = simulator.coordinate_missions.get(vin)
    mission = missions.get(vin)
    if record is not None and (mission is None or mission.task is not record['task']):
        mission_id = next(mission_ids)
        points = record['path']
        mission = Mission(
            mission_id,
            Stop(id=f's{-2 * mission_id}', name='배차 출발 위치', **points[0]),
            Stop(id=f's{-2 * mission_id - 1}', name='지도에서 선택한 목적지', **points[-1]),
            record['task'], points,
        )
        missions[vin] = mission
    return mission


def vehicle(vin: str) -> VehicleState:
    state = simulator.get_vehicle(vin)
    if state is None:
        raise MockError(404, "MOCK_NOT_FOUND", "차량을 찾을 수 없습니다.")
    return state


def numeric_id(internal_id: str) -> int:
    return int(internal_id[1:])


def has_vehicle_fault(state: VehicleState) -> bool:
    return state.has_fault


def status_fields(state: VehicleState):
    return {
        "vin": state.id, "vinId": state.name, "driveMode": int(state.power),
        "gear": state.gear, "speed": state.speed_kmh,
        "position": {"lon": state.lng, "lat": state.lat},
        "realBattery": round(state.battery), "mile": state.remaining_range_km,
        "occurTimestamp": time.time_ns() // 1_000_000, "powerState": state.online,
    }


@api.get("/getVehicleList", response_model=FlaggedResponse[list[VehicleListItem]], responses=AUTH_ERRORS,
          summary="차량 목록 조회", description="userId는 선택 입력이며 현재 Mock에서는 결과를 필터링하지 않습니다.")
async def list_vehicles(userId: str | None = None):
    return success([
        {"vin": v.id, "vinId": v.name, "vinCode": v.id, "parkCode": "MOCK_AOI_01",
         "parkName": v.aoi, "cabinCode": ""}
        for v in simulator.get_all_vehicles()
    ], include_flag=True)


@api.post("/getVehicleInfo", response_model=MockResponse[VehicleInfo], responses=VEHICLE_ERRORS,
          summary="차량 상태 조회", description="차량 식별자는 소문자 vin Query로 전달합니다.")
async def vehicle_info(vin: str):
    state = vehicle(vin)
    return success({**status_fields(state), "gnssHead": state.heading,
                    "parkCode": "MOCK_AOI_01", "parkName": state.aoi})


@api.post("/listStationByVin/v1", response_model=MockResponse[list[StationInfo]], responses=VEHICLE_ERRORS,
          summary="차량별 지점 목록 조회", description="차량 식별자는 대문자로 시작하는 Vin Query입니다. 현재 고정 거점을 사용하지 않아 빈 배열을 반환합니다.")
async def stations(Vin: str):
    state = vehicle(Vin)
    return success([
        {"lng": stop.lng, "lat": stop.lat, "stationName": stop.name,
         "stationId": numeric_id(stop.id), "parkCode": "MOCK_AOI_01", "parkName": state.aoi}
        for stop in simulator.get_all_stops()
    ])


@api.post("/vehicleStart/v1", response_model=MockResponse[MissionCreated], responses=CONTROL_ERRORS,
          summary="정류장 ID 배차", description="기존 정류장 ID 배차입니다. 기본 정류장이 비어 있어 지도 호출은 POST /api/dispatch를 사용합니다.")
async def start(body: StartRequest):
    state = vehicle(body.vin)
    stops = {str(numeric_id(stop.id)): stop for stop in simulator.get_all_stops()}
    departure = stops.get(body.departureStationId)
    destination = stops.get(body.destinationStationId)
    if departure is None or destination is None:
        raise MockError(404, "MOCK_NOT_FOUND", "지점을 찾을 수 없습니다.")
    if departure == destination:
        raise MockError(422, "MOCK_INVALID", "출발 지점과 도착 지점이 같을 수 없습니다.")
    if not state.dispatch_available:
        raise MockError(409, "MOCK_STATE", "현재 차량 상태에서 배차할 수 없습니다.")
    if haversine_distance_m(state.lat, state.lng, departure.lat, departure.lng) > 1.0:
        raise MockError(409, "MOCK_STATE", "차량이 출발 지점에 있어야 합니다.")
    try:
        started = simulator.start_dispatch_point(state.id, destination.id)
    except ValueError as error:
        raise MockError(422, "MOCK_INVALID", str(error)) from error
    if not started:
        raise MockError(409, "MOCK_STATE", "현재 차량 상태에서 배차할 수 없습니다.")
    task = state.task
    assert task is not None
    mission = Mission(next(mission_ids), departure, destination, task)
    missions[state.id] = mission
    return success({"missionId": mission.id})


@api.post("/getCurrentMission", response_model=MockResponse[CurrentMission | None], responses=VEHICLE_ERRORS,
          summary="현재 작업 조회 · 지도 배차 연동", description="지도에서 POST /api/dispatch로 호출한 좌표 배차도 조회합니다. 최초 작업 전에는 data:null, 상태는 1 주행·2 일시정지·3 완료·4 취소입니다. 완료·취소 결과는 다음 배차까지 유지합니다. 좌표 배차의 출발·도착 ID는 작업 전용 음수이며 고정 거점이 아닙니다. 순환 코스는 이 임무 API의 연동 대상이 아닙니다.")
async def current_mission(body: VehicleRequest):
    state = vehicle(body.vin)
    mission = resolve_mission(state.id)
    if mission is None or (state.task is not None and state.task is not mission.task):
        return success(None)
    if mission.task.phase == TaskPhase.ARRIVED:
        status = 3
    elif state.task is None:
        status = 4
    elif mission.task.paused:
        status = 2
    else:
        status = 1
    return success({
        "missionSubId": mission.id, "vin": state.id,
        "startStationId": numeric_id(mission.departure.id), "startStationName": mission.departure.name,
        "endStationId": numeric_id(mission.destination.id), "endStationName": mission.destination.name,
        "missionStatus": status,
    })


@api.post("/getPlanningRoute", response_model=FlaggedResponse[list[PlanningRoute]], responses=VEHICLE_ERRORS,
          summary="계획 경로 조회 · 지도 배차 연동", description="지도 호출 시 확정한 전체 주행 경로를 반환합니다. routePath는 좌표 배열, route는 지점 배열을 직렬화한 문자열입니다. 미작업·완료·취소 후에는 data:[]입니다.")
async def planning_route(body: VehicleRequest):
    state = vehicle(body.vin)
    mission = resolve_mission(body.vin)
    if mission is None or state.task is not mission.task or mission.task.phase == TaskPhase.ARRIVED:
        return success([], include_flag=True)
    stops = [mission.departure, mission.destination]
    points = ([[p['lat'], p['lng']] for p in mission.path] if mission.path is not None else
              road_path((stops[0].lat, stops[0].lng), (stops[1].lat, stops[1].lng)))
    return success([{
        "routeId": mission.id, "routeName": f"{stops[0].name} → {stops[1].name}",
        "distance": round(path_length(points)),
        "route": json.dumps([
            {"latitude": stop.lat, "longitude": stop.lng, "orderId": order,
             "stationId": numeric_id(stop.id), "stationName": stop.name}
            for order, stop in enumerate(stops, start=1)
        ], ensure_ascii=False),
        "routePath": [{"lat": lat, "lng": lng} for lat, lng in points],
    }], include_flag=True)


@api.post("/vehicleCancel", response_model=MockResponse[None], responses=CONTROL_ERRORS,
          summary="작업 취소 · 지도 배차 연동", description="지도 배차도 취소합니다. vin은 Query입니다. 주행 중에는 409이며 먼저 POST /mock/vehicles/{vin}/pause로 정지합니다. 관제 화면의 비상 정지도 현재 작업 조회에 취소로 반영됩니다.")
async def cancel(vin: str):
    state = vehicle(vin)
    mission = resolve_mission(vin)
    if state.speed_kmh != 0 or mission is None or state.task is not mission.task:
        raise MockError(409, "MOCK_STATE", "정차 상태의 작업만 취소할 수 있습니다.")
    simulator.stop(vin)
    return success(None)


@api.post("/powerOnOff", response_model=MockResponse[None], responses=CONTROL_ERRORS,
          summary="가상 차량 전원 제어", description="handleType 1 켜기, 2 끄기. 주행 중 끄기는 409입니다. 일시정지 후 끄면 작업이 취소되며 켜도 자동 재개하지 않습니다.")
async def power(body: PowerRequest):
    state = vehicle(body.vin)
    if body.handleType not in (1, 2):
        raise MockError(422, "MOCK_INVALID", "handleType은 1 또는 2여야 합니다.")
    if body.handleType == 2 and state.speed_kmh != 0:
        raise MockError(409, "MOCK_STATE", "정차 후 전원을 끌 수 있습니다.")
    if not simulator.control(state.id, power=body.handleType == 1, door_open=None, lights=None):
        raise MockError(409, "MOCK_STATE", "현재 차량 상태에서 전원을 제어할 수 없습니다.")
    return success(None)


@api.post("/batchGetVehicleList", response_model=MockResponse[list[BatchVehicleInfo]], responses=VEHICLE_ERRORS,
          summary="차량 상태 일괄 조회", description="vin 배열을 JSON으로 전달합니다. parkcode와 parkname은 소문자 필드입니다.")
async def batch_status(body: BatchRequest):
    results = []
    for vin in body.vin:
        state = vehicle(vin)
        is_fault = has_vehicle_fault(state)
        results.append({
            **status_fields(state), "parkcode": "MOCK_AOI_01", "parkname": state.aoi,
            "vehicleAvailable": int(not state.dispatch_available),
            "faultStatus": int(is_fault),
        })
    return success(results)


# 가상 주행 제어는 학생팀 Mock 전용 경로입니다.
controls = APIRouter(prefix="/mock/vehicles", dependencies=[Depends(authenticate)], route_class=MockRoute)


@controls.post("/{vin}/pause", response_model=MockResponse[None], responses=CONTROL_ERRORS,
               summary="주행 일시정지 · 지도 배차 연동",
               description="정류장 및 지도 좌표 배차에 적용하는 Mock 확장입니다. 공통 인증 Query가 필요합니다.")
async def pause(vin: str):
    state = vehicle(vin)
    mission = resolve_mission(vin)
    if mission is None or state.task is not mission.task or not state.power or not state.online:
        raise MockError(409, "MOCK_STATE", "일시정지할 수 있는 작업이 없습니다.")
    if not simulator.pause(vin):
        raise MockError(409, "MOCK_STATE", "일시정지할 수 있는 작업이 없습니다.")
    return success(None)


@controls.post("/{vin}/resume", response_model=MockResponse[None], responses=CONTROL_ERRORS,
               summary="주행 재개 · 지도 배차 연동",
               description="정류장 및 지도 좌표 배차에 적용하는 Mock 확장입니다. 공통 인증 Query가 필요합니다.")
async def resume(vin: str):
    state = vehicle(vin)
    mission = resolve_mission(vin)
    if mission is None or state.task is not mission.task or not state.power or not state.online or has_vehicle_fault(state):
        raise MockError(409, "MOCK_STATE", "재개할 수 있는 작업이 없습니다.")
    if not simulator.resume(vin):
        raise MockError(409, "MOCK_STATE", "재개할 수 있는 작업이 없습니다.")
    return success(None)


@controls.post("/{vin}/fault", response_model=MockResponse[FaultReportStatus], responses=CONTROL_ERRORS,
               summary="고장 신고 접수 및 해제 · Mock 확장",
               description="명세서 12장의 고장 신고 접수용 Mock 확장 API입니다. faultStatus=1(신고 접수) 시 차량이 주행 중이면 즉시 안전 일시정지되며 batchGetVehicleList의 faultStatus=1, vehicleAvailable=1로 반영됩니다. faultStatus=0으로 해제할 수 있습니다.")
async def report_fault(vin: str, body: FaultReportRequest | None = None):
    state = vehicle(vin)
    req = body or FaultReportRequest()
    if req.faultStatus not in (0, 1):
        raise MockError(422, "MOCK_INVALID", "faultStatus는 0 또는 1이어야 합니다.")
    simulator.report_fault(state.id, req.faultStatus, req.reason)
    return success({
        "vin": state.id,
        "faultStatus": state.fault_status,
        "reason": state.fault_reason,
    })


router.include_router(api)
router.include_router(controls)
