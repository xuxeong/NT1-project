import asyncio
import json
from pathlib import Path
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import PROJECT_NAME, PROJECT_VERSION, API_V1_PREFIX
from app.api import vehicles_router, dispatch_router, routes_router
from app.api.neolix import router as neolix_router
from app.simulator.vehicle_sim import simulator
from app.db.repository import db_logger

TILE_CACHE_DIR = Path(__file__).resolve().parent.parent / ".tile_cache"
OSM_TILE_HEADERS = {"User-Agent": "NT1-Neolix-Mock-Server/0.1 (Gachon-University-C-Track-Simulator)"}
_osm_http_client: httpx.AsyncClient | None = None


def get_osm_http_client() -> httpx.AsyncClient:
    global _osm_http_client
    if _osm_http_client is None or _osm_http_client.is_closed:
        _osm_http_client = httpx.AsyncClient(headers=OSM_TILE_HEADERS, timeout=10.0)
    return _osm_http_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 기동 시: DB에서 이전 차량 위치·배터리·진행 중 배차 작업을 이어받거나(Restore) 초기 차량을 적재하고 1Hz 시뮬레이션 시작
    db_logger.restore_or_seed_simulator(simulator)
    simulator.start_background_loop()
    yield
    # 서버 종료 시: 시뮬레이션 태스크 및 외부 HTTP 커넥션 풀 정리
    simulator.stop_background_loop()
    global _osm_http_client
    if _osm_http_client is not None and not _osm_http_client.is_closed:
        await _osm_http_client.aclose()
        _osm_http_client = None


app = FastAPI(
    title=PROJECT_NAME,
    version=PROJECT_VERSION,
    description="""
## 가천대학교 실습 프로젝트 - Neolix 가상 차량 Mock 관제 서버

NT1 실습 프로젝트 SW Architecture를 준수하여 구현된 **FastAPI 기반 Mock 서버**입니다.
- **가상 차량 시뮬레이션 엔진**: 충북대 C-Track 테스트베드 경로를 따라 초당 1회(1Hz) 위경도 보간 주행
- **표준 REST API**: 차량 상태 조회, 배차 명령, 비상 정차, 전원 제어
- **실시간 WebSocket 텔레메트리**: `/ws/telemetry`를 통한 초당 1회 실시간 위치 스트리밍
    """,
    lifespan=lifespan,
)

# CORS 설정 (모바일 앱 및 프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(vehicles_router, prefix=API_V1_PREFIX)
app.include_router(dispatch_router, prefix=API_V1_PREFIX)
app.include_router(routes_router, prefix=API_V1_PREFIX)
app.include_router(neolix_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "project": PROJECT_NAME,
        "version": PROJECT_VERSION,
        "docs_url": "/docs",
        "dashboard_url": "/dashboard",
        "description": "Neolix Mock Server is running.",
    }


@app.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
async def get_dashboard():
    """충북대 C-Track 테스트베드 실시간 지도 관제 대시보드 뷰어"""
    template_path = Path(__file__).parent / "templates" / "dashboard.html"
    return HTMLResponse(content=template_path.read_text(encoding="utf-8"))


@app.get("/api/health", tags=["Health"])
async def health_check():
    vehicles = simulator.get_all_vehicles()
    return {
        "ok": True,
        "vehicles_count": len(vehicles),
        "active_tasks": sum(1 for v in vehicles if v.task is not None),
    }


@app.get("/tiles/{z}/{x}/{y}.png", tags=["Map Tiles (OSM 지도 타일 중계)"])
@app.get("/api/tiles/{z}/{x}/{y}.png", tags=["Map Tiles (OSM 지도 타일 중계)"])
async def proxy_osm_tile(z: int, x: int, y: int):
    """모바일 앱(react-native-maps)을 위한 OpenStreetMap 타일 캐시 및 중계 엔드포인트."""
    if not (0 <= z <= 19) or x < 0 or y < 0:
        raise HTTPException(status_code=422, detail="유효하지 않은 타일 좌표입니다.")
    cache_file = TILE_CACHE_DIR / str(z) / str(x) / f"{y}.png"
    if cache_file.exists():
        return Response(
            content=cache_file.read_bytes(),
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    try:
        client = get_osm_http_client()
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="OSM 타일 조회 실패")
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(resp.content)
        return Response(
            content=resp.content,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OSM 타일 서버 연결 오류: {exc}") from exc


# 실시간 텔레메트리 WebSocket 엔드포인트
@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    모바일 앱 및 관제 대시보드를 위한 실시간 텔레메트리 스트림.
    1초 주기로 모든 가상 차량의 실시간 상태를 브로드캐스트합니다.
    """
    await websocket.accept()
    try:
        while True:
            data = [v.model_dump(mode="json") for v in simulator.get_all_vehicles()]
            await websocket.send_text(json.dumps({"type": "telemetry", "vehicles": data}, ensure_ascii=False))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
