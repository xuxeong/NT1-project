"""Student API response contracts shared by serialization and Swagger."""
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar('T')


class MockResponse(BaseModel, Generic[T]):
    code: Literal['10000'] = '10000'
    msg: str = '성공'
    data: T


class FlaggedResponse(MockResponse[T], Generic[T]):
    success: Literal[True] = True


class MockErrorResponse(BaseModel):
    code: Literal['MOCK_AUTH', 'MOCK_NOT_FOUND', 'MOCK_STATE', 'MOCK_INVALID']
    msg: str
    data: None = None


class TokenResponse(BaseModel):
    access_token: str = Field(description='발급된 토큰. 이후 공통 Query의 access_token으로 전달합니다.')
    token_type: Literal['bearer'] = 'bearer'
    expires_in: int = Field(3600, description='유효기간(초). 서버 재시작 시 재발급합니다.')
    scope: str = 'all'


class VehicleListItem(BaseModel):
    vin: str = Field(description='후속 API 요청에 사용할 차량 식별자', examples=['X3S1181'])
    vinId: str
    vinCode: str
    parkCode: str
    parkName: str
    cabinCode: str


class Position(BaseModel):
    lon: float = Field(description='경도. 경로 응답의 lng와 이름이 다릅니다.')
    lat: float


class VehicleStatusFields(BaseModel):
    vin: str
    vinId: str
    driveMode: int = Field(description='현재 Mock은 전원 켜짐 1, 꺼짐 0으로 반환합니다.')
    gear: Literal['P', 'R', 'N', 'D']
    speed: float = Field(description='km/h')
    position: Position
    realBattery: int = Field(description='배터리 잔량(%). 내부 battery를 정수 반올림한 값')
    mile: float = Field(description='배터리 기반 예상 주행 가능 거리(km), 소수 첫째 자리. 목적지까지의 경로 거리와 다릅니다.')
    occurTimestamp: int = Field(description='밀리초 단위 발생 시각')
    powerState: bool = Field(description='온라인 여부. 전원 명령 결과와 다릅니다.')


class VehicleInfo(VehicleStatusFields):
    gnssHead: float = Field(ge=0, lt=360, description='방위각(도). 북쪽 0, 동쪽 90, 남쪽 180, 서쪽 270. 정차 시 마지막 방향 유지')
    parkCode: str
    parkName: str


class BatchVehicleInfo(VehicleStatusFields):
    parkcode: str
    parkname: str
    vehicleAvailable: Literal[0, 1] = Field(description='0 이용 가능, 1 이용 불가')
    faultStatus: Literal[0, 1] = Field(description='0 정상, 1 이상')


class StationInfo(BaseModel):
    lng: float
    lat: float
    stationName: str
    stationId: int = Field(description='배차 요청 시 문자열로 변환합니다.')
    parkCode: str
    parkName: str


class MissionCreated(BaseModel):
    missionId: int


class FaultReportStatus(BaseModel):
    vin: str
    faultStatus: Literal[0, 1] = Field(description='0 정상(해제), 1 이상(고장 신고 접수)')
    reason: str | None = Field(None, description='고장 신고 사유')


class CurrentMission(BaseModel):
    missionSubId: int = Field(description='작업 ID. 계획 경로의 routeId와 같습니다.')
    vin: str
    startStationId: int = Field(description='좌표 배차는 작업 전용 음수 ID. 고정 정류장 ID가 아닙니다.')
    startStationName: str
    endStationId: int = Field(description='좌표 배차는 작업 전용 음수 ID. 정류장 배차에 재사용하지 않습니다.')
    endStationName: str
    missionStatus: Literal[1, 2, 3, 4] = Field(description='1 주행 중, 2 일시정지, 3 완료, 4 취소')


class RoutePoint(BaseModel):
    lat: float
    lng: float


class PlanningRoute(BaseModel):
    routeId: int
    routeName: str
    distance: int = Field(description='전체 경로 거리(m)')
    route: str = Field(
        description='출발·도착 지점 배열을 JSON으로 직렬화한 문자열. routePath는 배열입니다.',
        examples=['[{"latitude":36.7279642,"longitude":127.4419241,"orderId":1,"stationId":-2,"stationName":"배차 출발 위치"}]'],
    )
    routePath: list[RoutePoint] = Field(description='좌표 배차는 호출 확정 당시의 실제 전체 주행 경로')


AUTH_ERRORS = {
    401: {'model': MockErrorResponse, 'description': '토큰 만료 또는 인증·서명 불일치',
          'content': {'application/json': {'example': {'code': 'MOCK_AUTH', 'msg': 'Mock 인증 실패', 'data': None}}}},
    422: {'model': MockErrorResponse, 'description': '필수 필드 누락 또는 형식 오류',
          'content': {'application/json': {'example': {'code': 'MOCK_INVALID', 'msg': '요청 필드 또는 형식 오류', 'data': None}}}},
}
VEHICLE_ERRORS = {
    **AUTH_ERRORS,
    404: {'model': MockErrorResponse, 'description': '차량 또는 지점 없음'},
}
CONTROL_ERRORS = {
    **VEHICLE_ERRORS,
    409: {'model': MockErrorResponse, 'description': '현재 차량·작업 상태에서 처리 불가'},
}
