# NT1 자율주행 관제 시스템 (가천대학교 산학 실습 프로젝트)

> **가천대학교 실습 프로젝트**  
> Neolix 가상 자율주행 차량 관제 및 시뮬레이션 시스템

---

## 🏛 SW Architecture (시스템 구성도)

```mermaid
flowchart TB
    subgraph ClientLayer ["1. 클라이언트 계층 (Client Layer)"]
        App["📱 학생 개발 한국어 App (Android)<br/>(React Native / Expo)<br/>• OAuth 토큰 발급 및 SHA-1 서명 인증<br/>• 차량 조회, 중앙 핀 목적지 선택 및 배차<br/>• 주행 시작·일시정지·재개·취소"]
        Dashboard["🖥️ 실시간 지도 관제 뷰어 (/dashboard)<br/>(Leaflet.js / OpenStreetMap)<br/>• 1·2호차 실시간 위치·센서·제원 모니터링<br/>• 중앙 핀 드래그 경로 미리보기 및 배차 시연"]
    end

    subgraph ServerLayer ["2. Neolix Mock 서버 계층 (FastAPI Backend)"]
        subgraph Auth ["인증 및 서명 검증 계층"]
            OAuth["GET /auth/oauth/token<br/>(App Key / Secret 검증 및 토큰 발급)"]
            SigVerify["공통 Query & Header 검증<br/>(SHA-1 signature, timeStamp, nonce,<br/>access_token, X-From, X-Version)"]
        end

        subgraph API ["REST API & 실시간 통신 라우터"]
            NeolixAPI["정식 Neolix API (/openapi-server/slvapi/*)<br/>• getVehicleList, getVehicleInfo, batchGetVehicleList<br/>• getCurrentMission, getPlanningRoute<br/>• vehicleStart/v1, vehicleCancel, powerOnOff"]
            MockCtrlAPI["Mock 주행 제어 확장 (/mock/vehicles/{vin}/*)<br/>• pause (일시정지) / resume (주행 재개)"]
            DispatchAPI["지도 좌표 배차 & 관제 API (/api/*)<br/>• /api/dispatch, /api/dispatch/preview<br/>• /api/vehicles, /api/roads"]
            WS["실시간 텔레메트리 (/ws/telemetry)<br/>(1Hz WebSocket 브로드캐스트)"]
        end

        subgraph Core ["비즈니스 로직 & 데이터 모델"]
            Models["Pydantic v2 데이터 모델<br/>(VehicleState, N3/X3 제원, 센서, Mission)"]
            Bridge["작업-좌표 배차 브릿지 (resolve_mission)<br/>(지도 좌표 배차를 Neolix 작업·경로 API로 매핑)"]
        end

        subgraph SimEngine ["3. 가상 차량 물리 시뮬레이터 (Server-Internal Model)"]
            SimLoop["asyncio 1Hz 시뮬레이션 루프<br/>(15km/h = 초당 4.16m 도로 선분 보간 주행)"]
            RoadNet["C-Track OSM 도로망 엔진 (road_network.py)<br/>• 도로 선분 최근접 투영 (snap_to_road)<br/>• 일방통행 준수 다익스트라 최단경로 탐색"]
            Physics["차량 상태·물리 연산 엔진<br/>• Haversine 구면 거리 및 잔여 거리 연산<br/>• 배터리 소모(-0.015%/s) 및 통신 지연(RTT) 지터"]
        end
    end

    subgraph DataLayer ["4. 데이터 계층 (Data & Persistence)"]
        DB[("🗄️ PostgreSQL (Docker Compose)<br/>• 차량 상태 이력<br/>• 배차 및 이벤트 로그")]
        NT1Spec["📄 NT1 공식 제공 자료<br/>• Neolix API 명세서 (2026.11.18)<br/>• 충북대 C-Track OSM 도로망 (c_track_roads.json)<br/>• N3(X3) 차량 제원 및 디자인 에셋"]
    end

    App -->|"HTTP REST (OAuth + SHA-1)"| Auth
    Auth --> NeolixAPI
    Auth --> MockCtrlAPI
    App -->|"좌표 미리보기·배차 / WebSocket"| DispatchAPI
    App -.->|"1Hz 위치·상태 구독"| WS
    Dashboard -->|"HTTP REST / WebSocket"| DispatchAPI
    Dashboard -.->|"1Hz 실시간 관제"| WS

    NeolixAPI --> Bridge
    MockCtrlAPI --> Bridge
    DispatchAPI --> Core
    Bridge --> Core
    Core --> SimEngine
    SimLoop --> Physics
    SimLoop --> RoadNet

    SimEngine -.->|"1Hz 텔레메트리 푸시"| WS
    Core -.->|"상태·이력 적재"| DB
    NT1Spec -.->|"명세·도로망·제원 반영"| ServerLayer
```

---

## 📌 프로젝트 구조 (Repository Structure)

본 저장소는 모바일 관제 앱과 가상 관제 Mock 서버를 함께 관리하는 모노레포(Monorepo) 프로젝트입니다.

```text
NT1-project/
├── app/                        # [앱팀] React Native (Expo) 모바일 관제 앱
├── server/                     # [서버팀] FastAPI 기반 Mock 관제 서버 & C-Track 가상 주행 시뮬레이터
│   ├── app/                    # 서버 소스코드 (시뮬레이터, REST API, 대시보드)
│   ├── tests/                  # 비동기 E2E 단위 테스트
│   ├── Dockerfile              # 서버 도커 빌드 파일
│   ├── docker-compose.yml      # FastAPI + PostgreSQL 실행 환경
│   └── README.md               # 서버 실행 및 Swagger/대시보드 사용 설명서
├── docs/
│   └── APP_SERVER_INTEGRATION.md # 앱–서버 연동 가이드 및 공통 동작 규칙 명세서
├── progress/                   # 팀원별 일일 진행 상황 및 작업 일지
│   ├── README.md               # 일지 작성 가이드 및 템플릿
│   ├── choi_sujeong.md         # 최수정 작업 일지 (서버/시뮬레이션)
│   ├── han_seunggyu.md         # 한승규 작업 일지 (서버/API)
│   ├── hwang_dayoung.md        # 황다영 작업 일지 (앱/프론트엔드)
│   └── han_jeonghyeok.md       # 한정혁 작업 일지 (앱/백엔드·통신)
├── TEAM_RULES.md               # 팀 협업 규칙 및 Conventional Commits 가이드
└── README.md                   # 통합 프로젝트 개요 및 안내
```

---

## 🛠 파트별 담당 및 기술 스택

### 📱 앱 (Front-end)
* **담당**: 황다영, 한정혁
* **위치**: `app/`
* **스택**: TypeScript, React Native (Expo), React Navigation, react-native-maps

### 🚗 서버 & 시뮬레이터 (Back-end)
* **담당**: 최수정(시뮬레이션 엔진), 한승규(Mock 통신 & API)
* **위치**: `server/`
* **스택**: Python 3.11, FastAPI, asyncio, Pydantic v2, Docker Compose, Leaflet.js
* **실시간 대시보드**: [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
* **Swagger API 문서**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🤝 팀 협업 및 커밋 규칙

* 모든 커밋은 Conventional Commits 표준을 준수합니다. 세부 규칙은 [TEAM_RULES.md](./TEAM_RULES.md)를 참고해 주세요.
* 매일 작업 후 본인의 작업 일지를 [progress/](./progress/) 폴더 내 마크다운 파일에 기록합니다.
