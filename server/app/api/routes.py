from typing import List
from fastapi import APIRouter, HTTPException
from app.models.route import Stop, Route, AoiRegion, CreateStopRequest, CreateAoiRequest
from app.simulator.vehicle_sim import simulator
from app.simulator.road_network import DATA, NODES

router = APIRouter(prefix="", tags=["Routes & Stops (C-Track 경로 및 정류장)"])


@router.get("/stops", response_model=List[Stop], summary="C-Track 정류장(POI 거점 지점) 목록 조회")
async def get_stops():
    """C-Track 테스트베드 내에 등록된 POI(거점/정차 지점) 목록을 반환합니다."""
    return simulator.get_all_stops()


@router.post("/stops", response_model=Stop, summary="Pin 위치 기반 POI(거점 지점) 등록")
async def create_stop(req: CreateStopRequest):
    """지도 Pin으로 선택한 위경도를 가장 가까운 C-Track 도로 위로 보정하여 이름을 붙인 POI(거점)로 등록합니다."""
    try:
        return simulator.add_stop(req.name, req.lat, req.lng)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete("/stops/{stop_id}", summary="등록된 POI(거점 지점) 삭제")
async def remove_stop(stop_id: str):
    if not simulator.delete_stop(stop_id):
        raise HTTPException(status_code=404, detail="삭제할 POI 지점을 찾을 수 없습니다.")
    return {"ok": True, "deleted_id": stop_id}


@router.get("/aois", response_model=List[AoiRegion], summary="C-Track AOI(운행 구역) 목록 및 경계 폴리곤 조회")
async def get_aois():
    """C-Track 테스트베드에 설정된 AOI(Area of Interest, 운행 구역) 목록과 폴리곤 경계 좌표를 반환합니다."""
    return simulator.get_all_aois()


@router.post("/aois", response_model=AoiRegion, summary="신규 AOI(운행 구역) 생성 및 폴리곤 등록")
async def create_aoi(req: CreateAoiRequest):
    """새로운 AOI(운행 구역)를 생성하고 폴리곤 경계 좌표를 등록합니다."""
    try:
        return simulator.add_aoi(
            name=req.name,
            color=req.color,
            polygon=req.polygon,
            center_lat=req.center_lat,
            center_lng=req.center_lng,
            radius_m=req.radius_m,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete("/aois/{aoi_id}", summary="사용자 정의 AOI(운행 구역) 삭제")
async def remove_aoi(aoi_id: str):
    try:
        if not simulator.delete_aoi(aoi_id):
            raise HTTPException(status_code=404, detail="삭제할 AOI 구역을 찾을 수 없습니다.")
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"ok": True, "deleted_id": aoi_id}


@router.get("/routes", response_model=List[Route], summary="C-Track 주행 경로 목록 조회")
async def get_routes():
    """C-Track 테스트베드 내에 생성된 주행 코스 및 순환 경로 목록을 반환합니다."""
    return simulator.get_all_routes()


@router.get("/roads", summary="C-Track 세부 도로망 표시용 좌표")
async def get_roads():
    return {
        "source": DATA['source'],
        "roads": [
            {"oneway": way['oneway'],
             "path": [{"lat": NODES[node][0], "lng": NODES[node][1]}
                      for node in way['nodes']]}
            for way in DATA['ways']
        ],
    }
