# NT1 관제 앱 (가천대학교 실습 프로젝트)

> **NT1 자율주행 실습 프로젝트**  
> Neolix 가상 자율주행 차량을 조회·배차·관제하는 Android 앱

---

## 📌 프로젝트 개요

본 앱은 NT1 실습 프로젝트 SW Architecture를 준수하여 구현된 **React Native(Expo) 기반의 차량 관제 앱**입니다.  
서버팀의 FastAPI Mock 서버(`../server`)에 차량 조회·배차·제어 요청을 보내고, 가상 차량의 위치와 작업 상태를 화면에 보여 줍니다.

* **서버 연동 규칙 준수**: 인증, 작업 상태 코드, 제어 순서는 [`../docs/APP_SERVER_INTEGRATION.md`](../docs/APP_SERVER_INTEGRATION.md)를 따릅니다.
* **현재 단계**: 화면은 서버 연동 전이라 **임시 데이터(`src/mocks/`)**로 동작합니다. 서버 통신 계층(`src/api/`)은 연동 단계에서 추가됩니다.

---

## 🛠 기술 스택

| 구분 | 기술 | 사용 목적 |
|---|---|---|
| **Language** | TypeScript | 화면·데이터 타입 검사 |
| **Framework** | Expo SDK 58, React Native 0.88 | Android 앱 개발 및 Expo Go 실행 |
| **Navigation** | Expo Router | 파일 이름 = 화면 주소 방식의 화면 이동 |
| **Map** | react-native-maps | 차량 위치·경로 지도 표시 (배경은 Mock 서버가 중계하는 OSM 타일) |
| **Location** | expo-location | 사용자와 차량 사이 거리 계산 |
| **Font** | @expo-google-fonts (Noto Sans KR, Inter) | Figma 글자 스타일과 같은 글꼴 |
| **Icon** | react-native-svg, react-native-svg-transformer | Figma에서 내려받은 SVG 아이콘을 컴포넌트로 사용 |
| **Design** | Figma (NT1 파일) | 화면 디자인, 색상·글자 변수, 컴포넌트 |

---

## 👥 담당 역할

* **앱 화면(UI) 설계 및 프론트엔드**: 황다영
  * Figma 화면 디자인 및 디자인 토큰 정리 (`src/theme.ts`)
  * `src/app/`: 차량 목록·검색·필터, 차량 상세, 작업 경로 설정 등 화면 구현
  * `src/components/`, `src/ui.tsx`: 차량 카드, 상태 칩, 바텀 시트 등 공통 부품
* **앱 상태 관리 및 서버 통신**: 한정혁
  * `src/api/` (예정): OAuth 토큰 발급, SHA-1 서명, Neolix Mock API 호출
  * `src/mocks/` → 서버 응답으로 교체, 실시간 위치 갱신(1초 주기 조회 또는 `/ws/telemetry`)

---

## 🚀 빠른 시작 (Quick Start)

### 준비물
* Node.js 20 이상, npm
* Android 폰에 **Expo Go** 앱 설치 (Play 스토어) 또는 Android Studio 에뮬레이터

### 1. Android 폰(Expo Go)에서 실행 (권장)

```bash
cd app
npm install

# 개발 서버 실행 → 터미널에 QR 코드가 나옵니다
npx expo start
```

* 폰과 PC를 **같은 Wi-Fi**에 연결한 뒤, Expo Go 앱에서 QR 코드를 스캔합니다.
* 학교 Wi-Fi처럼 기기끼리 연결이 막혀 있으면 `npx expo start --tunnel`로 실행합니다.

### 2. Android 에뮬레이터에서 실행

```bash
# 에뮬레이터를 먼저 켠 뒤
npx expo start --android
```

### 지도 배경(OSM) 보기
* 지도 배경은 Mock 서버의 타일 중계 API(`GET /tiles/{z}/{x}/{y}.png`)로 받아 옵니다. **같은 PC에서 Mock 서버(`../server`, 8000번 포트)를 켜 두세요.** 
서버 실행 방법은 [server/README.md](../server/README.md) 참고. 서버가 꺼져 있으면 기본 지도만 보입니다.

---

## 📂 폴더 구조

```text
app/
├── assets/images/          # NT1 로고, N3 차량 이미지
├── assets/icons/           # Figma에서 내려받은 SVG 아이콘 (컴포넌트로 import)
├── metro.config.js         # SVG를 컴포넌트로 불러오는 설정
├── .svgrrc.js              # SVG 변환 설정
└── src/
    ├── app/                # 화면 (Expo Router). 파일 1개 = 화면 1개
    │   ├── _layout.tsx     # 글꼴 불러오기, 공통 상태(필터·경로), 화면 전환 설정
    │   ├── (tabs)/         # 하단 탭: index(차량 목록) · messages · account
    │   ├── vehicle/[vin].tsx      # 차량 상세
    │   ├── filter.tsx · region.tsx        # 차량 필터 · 운영 구역 선택
    │   ├── route-setup/[vin].tsx · stop-select.tsx  # 작업 경로 설정 · 지점 선택
    │   └── dispatch/[vin].tsx     # 목적지 선택 (지도 가운데 핀, 임시)
    ├── components/         # 여러 화면에서 쓰는 부품 (차량 카드, 바텀 시트, 확인 창, 로딩·오류 안내, 아이콘)
    ├── hooks/              # 화면에서 쓰는 훅 (사용자 위치, useAsync: 데이터 불러오기 + 로딩·오류·다시 시도)
    ├── state/              # 여러 화면이 함께 쓰는 상태 (차량 필터, 작업 경로, 토스트)
    ├── utils/              # 거리 계산, 차량 상태 문구, 센서 상태 판정, 와/과 조사
    ├── ui.tsx              # 공통 UI 부품 (버튼·버튼 로딩, 수치 칸, 제어 칸 등)
    ├── theme.ts            # 디자인 토큰 (Figma v2 변수 기준 색상·글꼴·글자 스타일)
    ├── types/              # 데이터 타입 (API 명세 필드명 기준), SVG import 타입
    ├── constants/          # 고정 값 (Mock 서버 주소, C-Track 좌표·지도 타일, 운영 구역, 고장 유형)
    ├── mocks/              # 서버 연동 전 임시 데이터·동작
    │                       #   vehicles·stations: 임시 차량·지점, vehicleActions: 버튼 동작 규칙
    │                       #   mockServer: 서버 요청 흉내 (응답 지연, 조회·요청 실패 상황)
    └── api/                # 서버 통신 계층 (예정)
```

### 프론트–통신 분담 약속
* 화면은 `src/types/vehicle.ts`의 `Vehicle` 타입만 사용합니다.
* 통신 계층(`src/api/`)은 서버 응답을 `Vehicle` 타입으로 바꿔서 화면에 넘겨 줍니다.
* 서버 연동 전까지 화면은 `src/mocks/`의 임시 데이터로 개발합니다.
* 화면은 데이터를 `src/mocks/mockServer.ts`의 함수로만 요청합니다. 연동할 때는 이 파일의 함수를 **같은 입력·출력 모양**의 실제 API 호출로 바꾸면 화면(로딩·오류·토스트 처리 포함)은 그대로 동작합니다.

### 로딩·오류 화면 확인 방법
서버 연동 전에는 `src/mocks/mockServer.ts`의 `MOCK_SCENARIO` 값을 바꿔서 확인합니다.
응답 지연 시간은 차량 목록·상세 조회 0.8초, 버튼 요청 0.6초로 설정되어 있습니다.

| 값 | 상황 | 화면 |
|---|---|---|
| `'success'` (기본) | 정상 | 0.8초 동안 회색 뼈대 후 화면 표시 |
| `'load-error'` | 차량 목록·상세 조회 실패 | "서버에 연결할 수 없어요" + 다시 시도 |
| `'action-error'` | 버튼 요청만 실패 | 버튼 로딩 후 "요청을 보내지 못했어요" 토스트 |

* 값을 바꾼 뒤에는 **앱을 새로고침**해야 반영됩니다 (에뮬레이터에서 `Ctrl + M` → Reload).
* 확인이 끝나면 **`'success'`로 되돌린 뒤 커밋**해 주세요.

### 구현 범위 메모 (NT1 11/16 피드백)
차량 상세 화면 항목 중 아래는 **구현하지 않습니다** (화면에는 두고, 누르면 "추후 지원 예정" 안내):  
10 상호작용 · 11 영상 모니터링 · 12 작업 로그 · 13 위치 보정 · 18 문 열기 · 19 원격 수동 제어 · 20 조명

---

## 🧪 검사 실행

```bash
npm run typecheck     # TypeScript 타입 검사
npx expo-doctor       # 의존성·설정 진단
```
