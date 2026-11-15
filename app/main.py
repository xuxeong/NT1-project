import asyncio
import json
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import PROJECT_NAME, PROJECT_VERSION, API_V1_PREFIX
from app.api import vehicles_router, dispatch_router, routes_router
from app.simulator.vehicle_sim import simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 기동 시: 가상 주행 물리 시뮬레이션 백그라운드 태스크 시작
    simulator.start_background_loop()
    yield
    # 서버 종료 시: 시뮬레이션 태스크 정리
    simulator.stop_background_loop()


app = FastAPI(
    title=PROJECT_NAME,
    version=PROJECT_VERSION,
    description="""
## 가천대학교 실습 프로젝트 - Neolix 가상 차량 Mock 관제 서버

NT1 실습 프로젝트 SW Architecture를 준수하여 구현된 **FastAPI 기반 Mock 서버**입니다.
- **가상 차량 시뮬레이션 엔진**: 충북대 C-Track 테스트베드 경로를 따라 초당 1회(1Hz) 위경도 보간 주행
- **표준 REST API**: 차량 상태 조회, 배차 명령, 비상 정차, 전원/조명/도어 제어
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
            data = [v.model_dump() for v in simulator.get_all_vehicles()]
            await websocket.send_text(json.dumps({"type": "telemetry", "vehicles": data}, ensure_ascii=False))
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
