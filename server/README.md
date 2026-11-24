# Neolix Mock Server (가천대학교 실습 프로젝트)

> **NT1 자율주행 실습 프로젝트**  
> Neolix 가상 자율주행 차량 관제 및 시뮬레이션 Mock 서버

---

## 📌 프로젝트 개요

본 프로젝트는 NT1 실습 프로젝트 SW Architecture를 준수하여 구현된 **FastAPI 기반 가상 차량 관제 Mock 서버**입니다.  
앱(한국어 클라이언트)으로부터 배차·제어 시험 요청을 수신하여 충북대학교 C-Track 테스트베드 경로를 따라 가상 차량의 위도·경도 및 상태를 실시간으로 갱신하고 조회 요청에 응답합니다.

* **SW Architecture 원칙 준수**: 가상 차량은 외장 기기 없이 **Mock 서버 내부의 데이터·동작 모델(`app/simulator/`)**로 완전 자립 동작합니다.
* **표준 REST API & Swagger UI**: `/docs`를 통해 모든 API를 시각적으로 테스트할 수 있습니다.
* **실시간 WebSocket 텔레메트리**: 1초 주기(1Hz)로 차량의 실시간 위치와 배터리, 속도, 상태를 브로드캐스트합니다.

---

## 🛠 기술 스택

| 구분 | 기술 | 사용 목적 |
|---|---|---|
| **Language** | Python 3.11 | Mock 서버 및 가상 차량 물리 시뮬레이션 |
| **Framework** | FastAPI, Uvicorn | 고성능 비동기 REST API 및 OpenAPI 스펙 생성 |
| **Concurrency** | asyncio | 초당 1회(1Hz) 백그라운드 가상 주행 물리 루프 |
| **Data Validation** | Pydantic v2 | 차량 상태 및 배차 요청/응답 데이터 모델링 |
| **Database** | PostgreSQL, SQLAlchemy | (연동 준비 완료) 차량 상태 이력 및 작업 로그 적재 |
| **Testing** | pytest, httpx | API 단위 및 비동기 E2E 테스트 |
| **Container** | Docker, Docker Compose | 서버 및 데이터베이스 원클릭 실행 환경 |

---

## 👥 담당 역할

* **가상 차량 물리 시뮬레이션 엔진 & 관제 대시보드**: 최수정
  * `app/simulator/vehicle_sim.py`: Haversine 구면 거리 계산, 시간당 선형 보간(Interpolation), 도착 감지, 배터리 소모 모델
  * `app/simulator/c_track_data.py`: 충북대 C-Track 기준 가상 차량(`X3S1181`, `X3S1182`) 초기 상태 모듈화
  * `app/templates/dashboard.html`: Leaflet.js & OpenStreetMap 기반 실시간 지도 관제 대시보드
* **Mock 서버 정식 API·인증 연동 & 도로망 경로 탐색**: 한승규
  * `app/api/neolix.py`: NT1 제공 정식 Neolix API(`/openapi-server/slvapi/*`), OAuth 토큰 및 SHA-1 서명 검증, Mock 일시정지/재개 확장 API
  * `app/simulator/road_network.py`: C-Track OSM 도로망(`c_track_roads.json`) 선분 투영 및 일방통행 최단경로 계산
  * `app/api/dispatch.py`: 지도 중앙 핀 목적지 경로 미리보기(`/api/dispatch/preview`) 및 좌표 배차(`/api/dispatch`)

---

## 🚀 빠른 시작 (Quick Start)

### 1. 로컬 환경에서 실행 (권장)

```bash
# 가상환경 생성 및 활성화 (선택)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행 (자동 리로드)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Docker Compose로 실행

```bash
docker-compose up -d --build
```

---

## 📖 API 문서 및 시연 (Swagger UI & Dashboard)

서버 실행 후 브라우저에서 아래 주소로 접속합니다:

* **실시간 지도 관제 대시보드**: [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
* **Swagger API 문서 (인터랙티브 테스트)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc 대안 문서**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 1) 학생 앱 연동용 정식 Neolix Mock API (`app/api/neolix.py`)

> 공통 인증: `/auth/oauth/token`을 제외한 모든 API는 Query(`signature`, `timeStamp`, `nonce`, `access_token`)와 Header(`X-From`, 선택 `X-Version`)가 필요합니다.

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/auth/oauth/token` | App Key(`client_id`) & Secret(`client_secret`) 검증 후 시험용 토큰 발급 |
| `GET` | `/openapi-server/slvapi/getVehicleList` | 사용자 소속 가상 차량 목록 조회 (`X3S1181`, `X3S1182`) |
| `POST` | `/openapi-server/slvapi/getVehicleInfo` | 특정 차량 실시간 위치, 속도, 기어, 배터리, 주행모드 조회 (`vin` Query) |
| `POST` | `/openapi-server/slvapi/batchGetVehicleList` | 다수 차량 상태, 가용 여부(`vehicleAvailable`), 고장 상태(`faultStatus`) 일괄 조회 |
| `POST` | `/openapi-server/slvapi/getCurrentMission` | 현재 작업(배차) 상태 조회 (`1`: 주행 중, `2`: 일시정지, `3`: 완료, `4`: 취소) |
| `POST` | `/openapi-server/slvapi/getPlanningRoute` | 현재 배차된 작업의 전체 계획 경로(`routePath` 좌표 배열 및 `route` 문자열) 조회 |
| `POST` | `/openapi-server/slvapi/vehicleCancel` | 정차 상태의 현재 작업 취소 (`vin` Query) |
| `POST` | `/openapi-server/slvapi/powerOnOff` | 가상 차량 전원 켜기(`handleType=1`) / 끄기(`handleType=2`) |
| `POST` | `/openapi-server/slvapi/listStationByVin/v1` | 차량별 고정 지점 목록 조회 (`Vin` Query, 현재 좌표 배차 사용으로 빈 배열 반환) |
| `POST` | `/openapi-server/slvapi/vehicleStart/v1` | 고정 정류장 ID 기반 배차 요청 (호환용) |
| `POST` | `/mock/vehicles/{vin}/pause` | **[Mock 확장]** 주행 중인 작업 일시정지 |
| `POST` | `/mock/vehicles/{vin}/resume` | **[Mock 확장]** 일시정지된 작업 주행 재개 |
| `POST` | `/mock/vehicles/{vin}/fault` | **[Mock 확장]** 차량 고장 신고 접수(`faultStatus=1`) 및 해제(`0`) |

### 2) 지도 좌표 배차 & 관제 대시보드 API (`app/api/`)

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/dispatch/preview` | 지도 선택 좌표의 C-Track 도로 선분 보정(Projection) 및 최단경로 미리보기 계산 |
| `POST` | `/api/dispatch` | 지도에서 선택한 목적지 좌표(`target_lat`, `target_lng`)로 배차 확정 및 주행 시작 |
| `POST` | `/api/dispatch/{id}/pause` | 관제 대시보드용 주행 일시정지 |
| `POST` | `/api/dispatch/{id}/resume` | 관제 대시보드용 주행 재개 |
| `POST` | `/api/dispatch/{id}/stop` | 관제 대시보드용 비상 정차 및 배차 취소 (`getCurrentMission`에 취소 `4`로 반영) |
| `GET` | `/api/vehicles` | 전체 가상 차량 상세 상태(센서 및 N3/X3 제원 포함) 조회 |
| `GET` | `/api/vehicles/{id}` | 특정 차량 상세 상태 조회 |
| `POST` | `/api/vehicles/{id}/control` | 차량 하드웨어 상태 제어 (전원, 도어, 조명) |
| `GET` | `/api/roads` | C-Track OSM 세부 도로망(`c_track_roads.json`) 렌더링용 좌표 조회 |
| `GET` | `/api/health` | 서버 상태 및 운행 중인 차량/작업 수 확인 |
| `WS` | `/ws/telemetry` | 초당 1회(1Hz) 실시간 텔레메트리 스트림 (WebSocket) |

---

## 🧪 테스트 실행

```bash
pytest
```
