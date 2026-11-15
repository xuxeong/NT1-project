# 🤝 팀 협업 및 Git 커밋 규칙 (Team Rules)

> 본 문서는 **Neolix Mock Server** 프로젝트의 원활한 협업과 일관된 코드 품질, 체계적인 Git 히스토리 관리를 위한 가이드입니다.  
> 모든 팀원은 작업 진행 시 본 규칙을 준수해 주시기 바랍니다.

---

## 📌 1. Git 커밋 컨벤션 (Commit Convention)

커밋 메시지는 **Conventional Commits** 표준에 따라 작성합니다.

### 1.1 기본 구조

```text
<type>(<scope>): <subject>
```

* **`type`**: 커밋의 목적 (필수)
* **`scope`**: 변경된 모듈 또는 도메인 (선택 사항이나 명확성을 위해 권장)
* **`subject`**: 변경 사항에 대한 명확하고 간결한 한국어 설명 (개조식)

---

### 1.2 Type 종류

| Type | 설명 | 사용 예시 |
|---|---|---|
| **`feat`** | 새로운 기능 추가 | `feat(api): 차량 상태 조회 필터 API 추가` |
| **`fix`** | 버그 수정 | `fix(simulator): 목표 지점 도착 판정 오차 수정` |
| **`docs`** | 문서 변경 (README, API 문서 등) | `docs: C-Track 연동 가이드 문서 업데이트` |
| **`refactor`**| 버그 수정이나 기능 추가 없는 코드 리팩토링 | `refactor(models): Pydantic 모델 검증 로직 개선` |
| **`test`** | 테스트 코드 추가 또는 수정 | `test: 배차 일시정지 비동기 테스트 케이스 추가` |
| **`infra`** | Docker, CI/CD, DB 인프라 환경 설정 | `infra: PostgreSQL 도커 볼륨 설정 추가` |
| **`chore`** | 빌드 설정, 의존성 패키지 변경, 기타 잡무 | `chore: requirements.txt 의존성 버전 업데이트` |

---

### 1.3 Scope 종류 (프로젝트 모듈 기준)

우리 프로젝트의 세부 모듈에 맞춰 아래 Scope를 사용합니다:

* **`simulator`**: 가상 차량 물리 연산, C-Track 데이터 (`app/simulator/`)
* **`api`**: REST API 엔드포인트 (`app/api/`)
* **`models`**: Pydantic 데이터 모델 (`app/models/`)
* **`server`**: FastAPI 진입점, 수명주기, WebSocket (`app/main.py`)
* **`dashboard`**: 지도 관제 대시보드 뷰어 (`app/templates/`)
* **`db`**: PostgreSQL 및 SQLAlchemy 연동

---

### 1.4 커밋 메시지 작성 예시

```bash
# 새로운 기능 추가
git commit -m "feat(simulator): C-Track 교차로 감속 물리 로직 추가"
git commit -m "feat(api): 차량 배터리 충전 요청 REST API 구현"

# 버그 수정
git commit -m "fix(server): WebSocket 연결 종료 시 세션 누수 방지 처리"

# 테스트 및 문서
git commit -m "test(api): 차량 비상 정지 API 단위 테스트 작성"
git commit -m "docs: API 명세서 변경점 업데이트"
```

---

## 🌿 2. 브랜치 전략 (Branching Strategy)

* **`main`**: 언제든지 시연 및 배포가 가능한 안정화 브랜치입니다.
* **`feature/<기능명>`**: 새로운 기능을 개발할 때 `main`에서 따서 작업합니다.
  * 예: `feature/c-track-real-coords` (실제 C-Track 좌표 반영)
  * 예: `feature/postgres-integration` (PostgreSQL DB 연동)
  * 예: `feature/fault-injection` (장애 주입 시나리오)

---

## 💡 3. 작업 및 커밋 원칙

1. **원자적 커밋 (Atomic Commit)**: 
   * 한 번에 너무 많은 파일(`git add .`)을 묶어서 커밋하지 않고, **하나의 기능/작업 단위로 쪼개어 커밋**합니다.
2. **풀(Pull) 먼저 하기**:
   * 작업을 시작하기 전에는 항상 `git pull origin main`을 실행하여 최신 코드를 유지합니다.
3. **실행 및 테스트 확인 후 푸시**:
   * 로컬에서 `uvicorn app.main:app` 및 `pytest`가 정상 통과하는지 확인 후 푸시합니다.
