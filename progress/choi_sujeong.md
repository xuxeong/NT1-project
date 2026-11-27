# 🚗 최수정 작업 일지

* **담당 파트**: Neolix Mock Server 아키텍처 설계, 가상 주행 물리 엔진, REST API, 대시보드 및 인프라 구축
* **핵심 모듈**: `app/` 전반 (`simulator/`, `api/`, `models/`, `main.py`, `templates/`), `Dockerfile`, `docker-compose.yml`

---

## [2026-11-16] Neolix Mock 관제 서버 아키텍처 및 C-Track 가상 주행 시뮬레이터 구축

* **담당 역할**: Mock 서버 아키텍처 수립 및 전체 구현 주도
* **주요 작업 내용**:

  1. **충북대 C-Track 가상 주행 물리 시뮬레이션 엔진 구현 (`app/simulator/`)**:
     * Haversine 구면 거리 공식을 적용하여 차량-목표 정류장 간 정밀 잔여 거리(m) 연산.
     * `asyncio` 백그라운드 태스크 기반 초당 1회(1Hz) 위도·경도 선형 보간(Linear Interpolation) 주행 물리 모델 구현 (15km/h 주행 속도 = 초당 약 4.16m 이동).
     * 주행 진행에 따른 배터리 점진적 소모(-0.015%/sec) 및 네트워크 지연(RTT) 지터 변동 로직 반영.
     * 목표 정류장 도착 감지(Arrived) 및 P/D 기어 자동 전환, C-Track 오창 테스트베드 정류장(s1~s5) 및 경로 데이터 모듈화 (`c_track_data.py`).

  2. **FastAPI 기반 차량 관제 및 배차 REST API 서버 구축 (`app/api/`, `app/models/`, `app/main.py`)**:
     * 차량 상태 조회(`GET /api/vehicles`), 원격 하드웨어 제어(`POST /api/vehicles/{id}/control`), 배차 및 비상 정차(`POST /api/dispatch`) REST 엔드포인트 구현.
     * Pydantic v2 기반 엄격한 데이터 유효성 검증 모델링 및 대화형 OpenAPI/Swagger 3.0 자동 문서화 (`/docs`).
     * 모바일 앱 및 웹 관제 연동을 위한 CORS 설정 및 1Hz 실시간 텔레메트리 WebSocket 스트림(`/ws/telemetry`) 구현.

  3. **Leaflet 기반 실시간 웹 지도 관제 대시보드 뷰어 개발 (`app/templates/dashboard.html`, `/dashboard`)**:
     * Leaflet.js 및 OpenStreetMap을 활용하여 C-Track 테스트베드 코스와 정류장을 시각화한 다크 테마 관제 인터페이스 구축.
     * WebSocket 텔레메트리와 연동하여 지도 위에서 차량 아이콘(🚗)이 실시간으로 이동하는 애니메이션 및 계기판(속도, 배터리, 기어) 렌더링.
     * 브라우저에서 원클릭으로 지점/순환 배차, 일시정지, 비상 정지를 실행하고 시연 영상을 녹화할 수 있는 제어 패널 내장.

  4. **컨테이너화 및 비동기 E2E 테스트 자동화 환경 구성 (`Dockerfile`, `docker-compose.yml`, `tests/`)**:
     * Python 3.11-slim 기반 `Dockerfile` 및 향후 데이터 적재를 위한 PostgreSQL 연동 준비 `docker-compose.yml` 작성.
     * `pytest` 및 `httpx` 기반 비동기 단위 및 배차 시뮬레이션 E2E 테스트 케이스 작성 (`tests/test_api.py`).

  5. **팀 협업 표준 및 Git 관리 체계 수립 (`TEAM_RULES.md`, `progress/`)**:
     * Conventional Commits 규칙에 맞춘 9단계 세분화 커밋(Atomic Commits) 적용 및 GitHub 원격 저장소 푸시 완료.
     * 팀 협업 규칙 가이드(`TEAM_RULES.md`) 작성 및 팀원별 일일 진행 상황 기록 체계(`progress/`) 구축.

* **기술적 고민 & 해결 (Troubleshooting)**:
  * **아키텍처 원칙 준수**: 외부 기기(라즈베리 파이) 의존성을 없애고, PDF 공식 명세인 *"가상 차량은 Mock 서버 내부의 데이터·동작 모델"* 원칙에 맞춰 서버 내부에서 완전 자립 동작하는 `asyncio` 시뮬레이터로 구현함.
  * **시각적 시연 환경 확보**: 텍스트 형태의 Swagger UI 외에 실제 주행 과정을 직관적으로 확인하고 영상으로 담을 수 있도록 가벼운 내장형 웹 지도 대시보드(`/dashboard`)를 구축함.

* **다음 작업 계획**:
  * 11/16 멘토님 미팅을 통해 충북대 C-Track 공식 지도/좌표 자료 수령 후 `c_track_data.py`에 실제 좌표 반영.
  * 장애 주입 시나리오(통신 단절, 배터리 급방전 등) 시뮬레이션 옵션 추가 검토.

---

## [2026-11-24] 고장 신고 Mock 확장 API 연동, 방위각·주행가능거리 동적 연산 및 앱-서버 공통 연동 명세 정립

* **담당 역할**: 시뮬레이터 동적 물리 연산 고도화, 명세서 12장 고장 신고 Mock API 보완, 통합 아키텍처 및 앱-서버 연동 가이드 문서화
* **주요 작업 내용**:

  1. **도로 선분 주행 방위각(`gnssHead`) 및 잔여 주행가능거리(`mile`) 동적 연산 (`app/simulator/vehicle_sim.py`, `app/models/vehicle.py`, `app/api/neolix.py`)**:
     * 주행 중 현재 위·경도에서 다음 도로 경유점(`_waypoints`)을 바라보는 정북 기준 시계방향 방위각(`0.0° ~ 360.0°`) 계산 함수(`calculate_bearing_deg`)를 구현하고 `VehicleState.heading` 및 `getVehicleInfo`의 `gnssHead`에 실시간 연동.
     * 차량 제원(`N3/X3` 만충 주행거리 `100.0km`)과 실시간 배터리 잔량(`battery`) 비율을 연동하여 `getVehicleInfo` 및 `batchGetVehicleList`의 `mile` 필드가 동적으로 감쇠하도록 반영.

  2. **명세서 12장 기준 고장 신고 접수 및 해제 Mock 확장 API 구현 (`app/api/neolix.py`, `app/models/neolix.py`, `app/api/dispatch.py`, `tests/test_mock_api.py`)**:
     * 공통 인증(OAuth 토큰 + SHA-1 서명 + `X-From` 헤더)을 사용하는 `POST /mock/vehicles/{vin}/fault` 엔드포인트 추가.
     * 고장 신고(`faultStatus = 1`) 접수 시 주행 중인 차량은 즉시 안전 일시정지(`missionStatus = 2`, `speed = 0.0`, `gear = P`)로 전환되며, `batchGetVehicleList`의 `faultStatus = 1` 및 `vehicleAvailable = 1`(배차 불가)로 반영.
     * 고장 상태에서 신규 배차 및 주행 재개(`resume`) 요청 시 `409 Conflict`(`MOCK_STATE`)로 차단하고, 고장 해제(`faultStatus = 0`) 후 정상 재개되도록 비동기 E2E 테스트(`tests/test_mock_api.py`) 검증 완료 (전체 16개 테스트 통과).

  3. **통합 SW 구성도 최신화 및 앱-서버 공통 동작 규칙 명세서 작성 (`README.md`, `server/README.md`, `docs/APP_SERVER_INTEGRATION.md`)**:
     * 루트 `README.md`의 Mermaid 시스템 구성도 및 `server/README.md`의 API 목록을 정식 Neolix API(`/openapi-server/slvapi/*`), OAuth/SHA-1 인증, OSM 도로망 좌표 배차 브릿지 구조에 맞게 최신화.
     * NT1 `11/18 개발 방향 안내`에서 요청한 앱-서버 공통 동작 규칙(인증/서명, 중앙 핀 드래그 경로 미리보기·호출 시퀀스, 일시정지·재개·취소·전원 상태 전이 규칙, 거리 계산·네트워크 지연 구간·고장 신고·제외 기능 7종)을 `docs/APP_SERVER_INTEGRATION.md`에 체계적으로 문서화.

* **다음 작업 계획**:
  * PostgreSQL 데이터베이스 및 SQLAlchemy ORM 연동 (차량 상태 이력 및 배차 작업 로그 영구 적재).
  * 11/27(금) NT1 정기 회의 및 ~11/29(일) 앱-서버 1차 통합 연동 테스트 진행.

---

## [2026-11-25] PostgreSQL & SQLAlchemy ORM 데이터베이스 영구 적재 연동

* **담당 역할**: 차량 상태 스냅샷, 배차 작업(Mission) 이력 및 이벤트 감사 로그 DB 영구 적재 아키텍처 구현
* **주요 작업 내용**:

  1. **PostgreSQL & SQLite 호환 SQLAlchemy 2.0 ORM 엔진 및 세션 구축 (`app/db/database.py`, `app/config.py`)**:
     * `docker-compose.yml`의 PostgreSQL(`DATABASE_URL`) 환경과 로컬 개발·테스트용 SQLite 폴백을 동시에 지원하는 하이브리드 DB 연결 구조 구현.
     * 서버 기동(`lifespan`) 시 ORM 테이블 자동 초기화(`init_db()`) 및 초기 가상 차량(`X3S1181`, `X3S1182`) 상태 DB 동기화 연동.

  2. **차량·배차·이벤트 3대 핵심 ORM 모델 및 리포지토리 구현 (`app/db/models.py`, `app/db/repository.py`)**:
     * `VehicleRecord` (`vehicles`): 차량 최신 위치, 방위각, 속도, 기어, 배터리, 전원, 온라인, 고장 상태 Upsert.
     * `MissionRecord` (`mission_logs`): 배차 작업 생성(`1`), 일시정지(`2`), 도착 완료(`3`), 작업 취소(`4`) 상태 전이 및 출발·목적지 좌표, 총 주행 거리 이력 저장.
     * `VehicleEventRecord` (`vehicle_event_logs`): `DISPATCH_START`, `PAUSE`, `RESUME`, `ARRIVED`, `CANCEL`, `POWER_CHANGE`, `FAULT_REPORT`, `FAULT_CLEAR` 이벤트 감사 로그 기록.

  3. **시뮬레이터 생명주기 DB 자동 적재 및 이력 조회 REST API 추가 (`app/simulator/vehicle_sim.py`, `app/api/vehicles.py`, `tests/test_db_persistence.py`)**:
     * 시뮬레이터에서 배차 시작·일시정지·재개·도착·취소·전원·고장신고 발생 시 DB에 자동 기록되도록 연결.
     * 적재된 배차 작업 이력 및 이벤트 로그를 조회하는 `GET /api/vehicles/history/missions`, `GET /api/vehicles/history/events` 엔드포인트 구현.
     * 인메모리 SQLite 기반 격리 단위 테스트(`tests/test_db_persistence.py`) 작성 및 검증 완료 (전체 pytest 통과).

* **작업 상태 및 다음 계획**:
  * 코드·테스트는 `feature/postgres-sqlalchemy-orm` 브랜치에 커밋·푸시 완료 (`main` 병합 전).
  * `feature/vehicle-api-refinement` 브랜치와 함께 `main` 병합 후 통합 동작 확인 및 ~11/29(일) 앱-서버 1차 연동 검증 진행 예정.

---

## [2026-11-26] 서버 재시작 시 DB 차량·작업 상태 이어받기(State Recovery) 및 앱 OSM 지도 타일 중계 API 구현

* **담당 역할**: 서버 재시작 시 DB 저장 상태·미완료 배차 작업 복원(이어받기) 로직 및 앱 지도 배경용 OSM 타일 캐시·프록시 API 구현
* **주요 작업 내용**:

  1. **서버 재시작 시 DB 차량 상태 및 배차 작업 이어받기 (`app/db/repository.py`, `app/main.py`)**:
     * 서버 기동(`lifespan`) 시 초기값으로 덮어쓰지 않고 `db_logger.restore_or_seed_simulator(simulator)`를 호출하도록 개선.
     * `vehicles` 테이블에 저장된 차량별 최신 위·경도(`lat`, `lng`), 방위각(`heading`), 배터리(`battery`), 전원(`power`), 온라인(`online`), 고장 상태(`fault_status`, `fault_reason`)를 시뮬레이터에 그대로 복원.
     * `mission_logs` 테이블에서 각 차량의 마지막 배차 작업을 조회하여:
       * 주행 중(`1`) 또는 일시정지(`2`) 상태였던 미완료 작업은 현재 위치부터 목적지까지의 남은 도로 경로(`road_path`)와 전체 계획 경로 스냅샷(`coordinate_missions`)을 재구성하여 주행을 이어받거나(`resumed_driving`) 일시정지 상태를 유지(`restored_paused`).
       * 도착 완료(`3`) 또는 취소(`4`) 상태였던 작업도 `_last_task_status` 및 작업 스냅샷을 복원하여 재시작 후에도 `getCurrentMission` 조회 결과가 유지되도록 처리.

  2. **시연·테스트용 초기 상태 리셋 API 추가 (`POST /api/vehicles/reset`, `app/api/vehicles.py`)**:
     * 재시작 이어받기 적용 후 시연이나 반복 테스트 시 초기 출발 위치·배터리·무작업 상태로 즉시 되돌릴 수 있는 `POST /api/vehicles/reset` 엔드포인트 및 `db_logger.reset_all_state()` 구현.

  3. **앱팀 요청 OSM 지도 타일 캐시·중계(Proxy) API 구현 (`GET /tiles/{z}/{x}/{y}.png`, `app/main.py`)**:
     * 모바일 앱(`react-native-maps`)이 OSM 타일 서버에 직접 요청할 때 User-Agent 헤더 제한으로 차단되는 문제를 해결하기 위해 `GET /tiles/{z}/{x}/{y}.png` (및 `/api/tiles/{z}/{x}/{y}.png`) 중계 엔드포인트 추가.
     * 서버가 공식 User-Agent 헤더로 타일을 요청하고 로컬 `.tile_cache/` 디렉터리에 캐싱하여 재요청 시 외부 호출 없이 즉시 반환.

  4. **자동화 테스트 검증 (`tests/test_db_persistence.py`)**:
     * 서버 재시작 모사 시 주행 중(`1`) 작업 이어받아 목적지 도착 검증, 고장 일시정지(`2`) 작업 복원 검증, 완료(`3`) 상태 보존 검증, 상태 리셋(`/api/vehicles/reset`) 및 OSM 타일 중계(`/tiles/{z}/{x}/{y}.png`) 검증 테스트 추가 (전체 **45개 pytest 100% 통과**).

---

## [2026-11-27] 앱 작업 정보·고장 카드 연동 대비 주행 진행률 동적 갱신 및 고장 신고 시각 필드 보완

* **담당 역할**: 앱 UI(`TaskInfoSheet.tsx`, `FaultCard.tsx`) 데이터 요구사항 대조 및 시뮬레이터·DB 모델 필드 보완
* **주요 작업 내용**:

  1. **주행 중 실시간 작업 진행률(`progress_percent`) 동적 연산 및 작업 메타데이터 보강 (`app/models/vehicle.py`, `app/simulator/vehicle_sim.py`)**:
     * 모바일 앱 작업 정보 시트(`TaskInfoSheet.tsx`)의 진행률·전체 경로 거리·작업 시작 시각 표시 요구사항에 맞춰 `VehicleTask`에 `total_distance_m` 및 `started_at_ms`(밀리초 타임스탬프) 필드 추가.
     * `tick_one_second()` 루프에서 매초 `remaining_distance_m` 감소에 비례하여 `progress_percent`(`0.0% ~ 100.0%`)가 실시간으로 갱신되도록 보완.

  2. **고장 신고 시각(`fault_reported_at_ms`) 저장 및 DB 복원 연동 (`app/models/vehicle.py`, `app/db/models.py`, `app/db/repository.py`)**:
     * 모바일 앱 고장 신고 카드(`FaultCard.tsx`)의 신고 시각(`reportedAt`) 표시와 연동되도록 `VehicleState` 및 DB `vehicles` 테이블에 `fault_reported_at_ms` 필드 추가.
     * 고장 신고 접수(`fault_status = 1`) 시 밀리초 시각을 기록하고, 고장 해제(`0`) 시 초기화하며, 서버 재시작 이어받기(`restore_or_seed_simulator`) 시에도 `total_distance_m`, `started_at_ms`, `fault_reported_at_ms`가 함께 복원되도록 처리.

  3. **매초 DB 스냅샷 쓰기(I/O) 최적화 및 타일 프록시 커넥션 풀·WebSocket 직렬화 개선 (`app/db/repository.py`, `app/main.py`)**:
     * `tick_one_second()` 후크에서 정차 중인 모든 차량을 매초 DB에 중복 `UPDATE`하던 비효율을 개선하여, 실제 주행 중인 활성 차량(`active_tasks`)만 매초 스냅샷을 갱신하도록 최적화.
     * OSM 타일 중계 API(`/tiles/{z}/{x}/{y}.png`)에서 타일 요청마다 새 `httpx.AsyncClient`를 생성·종료하던 방식을 공유 커넥션 풀 재사용 구조로 개선하고, WebSocket 텔레메트리 송신 시 `model_dump(mode="json")`을 적용하여 직렬화 안정성 확보 (전체 **45개 pytest 100% 통과**).

  4. **멘토링 요청사항 반영: AOI(운행 구역) 생성·폴리곤 시각화 및 Pin 기반 POI(거점 지점) 설정·배차 연동 (`app/api/routes.py`, `app/simulator/vehicle_sim.py`, `app/templates/dashboard.html`, `tests/test_aoi_poi.py`)**:
     * 11/27 4차 멘토링 요청사항(AOI 생성 및 POI 설정 시연)에 맞춰 C-Track 기본 운행 구역(`MOCK_AOI_01`: `C-Track 오창`) 경계 폴리곤 데이터(`INITIAL_AOIS`)와 동적 AOI 조회·생성·삭제 API(`GET/POST/DELETE /api/aois`) 구현.
     * 지도 중앙 핀(`📍`)으로 선택한 좌표를 C-Track 도로 선분 위로 자동 보정(Snap)하여 이름을 붙인 POI(거점)로 등록·삭제하는 API(`POST/DELETE /api/stops`)를 추가하고, 등록된 POI가 학생 앱 지점 조회 API(`POST /openapi-server/slvapi/listStationByVin/v1`) 및 좌표 배차(`target_name`)와 연동되도록 연결.
     * 관제 대시보드(`/dashboard`)에 **AOI 반경 슬라이더(`40m~400m`) 실시간 미리보기**, **지도 클릭 기반 다각형(Polygon) 직접 그리기 모드**, **현재 핀 위치 POI 등록 및 원클릭 POI 목적지 배차**, **초기 상태 리셋(`🔄 초기 리셋`)** UI를 구축하고 비동기 통합 테스트(`tests/test_aoi_poi.py`) 검증 완료 (전체 **52개 pytest 100% 통과**).

  5. **11/27 멘토링 확정 요구사항 반영: DB 가상 담당자 계정 로그인, 계정별 할당 차량 필터링 및 도착·고장 시 담당자 연락처 알림 기능 구현 (`app/db/models.py`, `app/db/repository.py`, `app/api/managers.py`, `app/api/neolix.py`, `tests/test_manager_auth.py`)**:
     * 회원가입 없이 사전 적재된 가상 계정으로 로그인할 수 있도록 `ManagerAccountRecord`(`manager_accounts`) ORM 테이블 및 기본 시드 계정 3종(`manager1`: 1호차 담당, `manager2`: 2호차 담당, `admin`: 1·2호차 전체 담당) 자동 적재 로직(`ensure_default_managers`) 구현.
     * 담당자 로그인(`POST /api/managers/login`), 계정 목록·상세 조회(`GET /api/managers`, `GET /api/managers/{user_id}`), 담당자 연락처·할당 차량 수정(`PATCH /api/managers/{user_id}/contact`) API 추가.
     * `GET /openapi-server/slvapi/getVehicleList?userId=...` 및 `GET /api/vehicles?user_id=...` 호출 시 `userId`가 생략되면 기존 1차 연동과 동일하게 전체 차량을 반환하고, 로그인한 담당자 `userId`가 전달되면 해당 계정에 할당된 차량만 필터링하여 반환하도록 하위 호환 연동.
     * 차량 목적지 도착(`ARRIVED`) 및 고장 신고(`FAULT_REPORT`) 발생 시 해당 차량 담당자의 연락처(`phone`)로 알림을 자동 발송·기록하는 `ManagerNotificationRecord`(`manager_notifications`) 및 알림 이력 조회 API(`GET /api/managers/notifications`) 구현 (전체 **53개 pytest 100% 통과**).
