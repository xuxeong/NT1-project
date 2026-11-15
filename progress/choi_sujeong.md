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
