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

* **가상 차량 물리 시뮬레이션 엔진**: 최수정
  * `app/simulator/vehicle_sim.py`: Haversine 구면 거리 계산, 시간당 선형 보간(Interpolation), 도착 감지, 배터리 소모 모델
  * `app/simulator/c_track_data.py`: 충북대 C-Track 기준 정류장 및 경로 데이터 모듈화
* **Mock 서버 통신 및 API 인프라**: 한승규
  * `app/api/`: REST 엔드포인트 설계 (`/vehicles`, `/dispatch`, `/routes`, `/stops`)
  * `app/main.py`: 실시간 WebSocket (`/ws/telemetry`), Docker Compose 환경 구성

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

## 📖 API 문서 및 시연 (Swagger UI)

서버 실행 후 브라우저에서 아래 주소로 접속합니다:

* **Swagger API 문서 (인터랙티브 테스트)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc 대안 문서**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 주요 API 엔드포인트

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/api/health` | 서버 상태 및 운행 중인 차량/작업 수 확인 |
| `GET` | `/api/vehicles` | 전체 가상 차량의 실시간 위치, 배터리, 속도 조회 |
| `GET` | `/api/vehicles/{id}` | 특정 차량 상세 상태 조회 |
| `POST` | `/api/dispatch` | 차량 배차 요청 (지점 이동 또는 순환 코스 주행) |
| `POST` | `/api/dispatch/{id}/pause` | 주행 일시정지 |
| `POST` | `/api/dispatch/{id}/resume` | 주행 재개 |
| `POST` | `/api/dispatch/{id}/stop` | 비상 정차 및 배차 취소 |
| `POST` | `/api/vehicles/{id}/control` | 차량 하드웨어 제어 (전원, 도어, 조명) |
| `GET` | `/api/stops` | C-Track 정류장(지점) 목록 조회 |
| `GET` | `/api/routes` | C-Track 주행 경로 목록 조회 |
| `WS` | `/ws/telemetry` | 초당 1회 실시간 텔레메트리 스트림 (WebSocket) |

---

## 🧪 테스트 실행

```bash
pytest
```

---

## 🔄 충북대 C-Track 공식 데이터 반영 안내

NT1 및 멘토님 미팅을 통해 충북대 C-Track 공식 GeoJSON 또는 좌표가 제공되면:
* `app/simulator/c_track_data.py` 파일 내의 `INITIAL_STOPS` 및 `INITIAL_ROUTES` 리스트만 교체하면 즉시 반영됩니다.
