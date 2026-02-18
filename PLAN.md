# Valid8 테스트 전략 계획

## 개요

외부 API(Claude, Tavily, GitHub)에 의존하는 SSE 스트리밍 파이프라인 특성상, **모킹 기반 자동 테스트**와 **실제 API 기반 검증 테스트**를 분리하여 구성합니다.

---

## 1. 자동화 테스트 (Backend — pytest)

### 1-1. 단위 테스트 (순수 함수, API 호출 없음)

| 테스트 대상 | 테스트 케이스 | 검증 포인트 |
|---|---|---|
| `_parse_json_safe()` | 유효한 JSON 문자열 | 정상 파싱 |
| | `\`\`\`json ... \`\`\`` 으로 감싼 응답 | 마크다운 블록에서 추출 |
| | 앞뒤에 텍스트가 붙은 `{...}` | brace 추출 |
| | 완전 garbage 입력 | fallback dict 반환 |
| | 빈 문자열 | fallback dict 반환 |
| | 중첩 `{...}` JSON | 최외곽 brace 파싱 |
| `_fallback_feasibility()` | 임의 idea 입력 | score=50, overall_feasibility="partial", 필수 키 존재 |
| `_fallback_differentiation()` | comp_count=0 | blue_ocean, score=100 |
| | comp_count=10 | moderate, score=50 |
| | comp_count=25 | red_ocean, score=0 (clamped) |
| `_fallback_verdict()` | f=80, d=80 (avg=80) | verdict="GO" |
| | f=50, d=50 (avg=50) | verdict="PIVOT" |
| | f=20, d=20 (avg=20) | verdict="KILL" |
| | 경계값 f=70, d=70 (avg=70) | verdict="GO" |
| | 경계값 f=40, d=38 (avg=39) | verdict="KILL" |
| `AnalyzeRequest` (Pydantic) | 빈 문자열 idea | ValidationError |
| | 501자 idea | ValidationError |
| | 공백만 있는 idea | ValidationError |
| | 유효한 idea + mode="hackathon" | 정상 |
| | mode="invalid" | ValidationError |

**파일**: `backend/tests/test_unit.py`

### 1-2. 통합 테스트 (외부 API 모킹)

모든 외부 호출(Tavily, GitHub, Claude)을 `unittest.mock.AsyncMock`으로 대체하여 전체 파이프라인을 테스트합니다.

| 테스트 시나리오 | 모킹 대상 | 검증 포인트 |
|---|---|---|
| 정상 파이프라인 | Tavily, GitHub, Claude 모두 정상 응답 | 5개 step_start + 5개 step_result + done 이벤트 순서 |
| Tavily 장애 | Tavily → Exception | Step 1 결과에 빈 competitors + 에러 summary |
| GitHub 장애 | GitHub → Exception | Step 2 결과에 빈 repos + 에러 summary |
| Claude 장애 | Claude → Exception | Step 3-5에 fallback 결과 사용 |
| API 키 없음 | anthropic_api_key="" | fallback 경로 전체 작동 |
| SSE 이벤트 구조 | 전체 | 각 이벤트의 event/data 키 존재, step 번호 1-5 순차 |

**파일**: `backend/tests/test_integration.py`

### 1-3. API 엔드포인트 테스트 (FastAPI TestClient)

| 엔드포인트 | 테스트 케이스 | 기대 결과 |
|---|---|---|
| `GET /health` | 호출 | 200 + `{"status": "ok"}` |
| `POST /api/analyze` | 유효한 요청 (모킹된 분석기) | 200 + SSE 스트림 |
| | idea 빈 문자열 | 422 에러 |
| | idea 501자 초과 | 422 에러 |
| | mode="invalid" | 422 에러 |
| | Content-Type 없음 | 422 에러 |

**파일**: `backend/tests/test_api.py`

### 1-4. 스키마 검증 테스트

각 step의 결과가 프론트엔드 TypeScript 타입 정의와 일치하는지 검증합니다. jsonschema를 사용하여 모킹된 파이프라인 결과를 검증합니다.

| 스키마 | 필수 필드 | 값 범위 검증 |
|---|---|---|
| WebSearchResult | competitors, raw_count, summary | raw_count >= 0 |
| GitHubSearchResult | repos, total_count, summary | total_count >= 0 |
| FeasibilityResult | overall_feasibility, score, tech_requirements, key_risks, time_estimate, summary | score: 0-100, overall_feasibility ∈ {possible, partial, difficult} |
| DifferentiationResult | competition_level, competition_score, existing_solutions, unique_angles, devil_arguments, pivot_suggestions, summary | competition_score: 0-100, competition_level ∈ {blue_ocean, moderate, red_ocean} |
| VerdictResult | verdict, confidence, overall_score, scores, one_liner, recommendation, alternative_ideas | verdict ∈ {GO, PIVOT, KILL}, scores 각 0-100, confidence 0-100 |

**파일**: `backend/tests/test_schema.py`

---

## 2. 자동화 테스트 (실제 API — 선택적, 별도 마커)

> `@pytest.mark.live_api`로 마킹하여 일반 테스트 실행 시 스킵, `pytest -m live_api`로 별도 실행

### 2-1. 샘플 아이디어 스모크 테스트

3개의 미리 정의된 샘플 아이디어로 실제 API를 호출하여 **결과 구조**를 검증합니다.

**샘플 아이디어**:
1. `"AI 기반 코드 리뷰 자동화 도구"` (hackathon)
2. `"실시간 환율 비교 알림 앱"` (startup)
3. `"개발자 포트폴리오 자동 생성 CLI"` (sideproject)

**검증 항목**:
- 5개 step 모두 result 존재
- 각 result가 해당 스키마를 만족
- 모든 score가 0-100 범위 내
- verdict가 GO/PIVOT/KILL 중 하나
- competition_level이 유효한 값
- alternative_ideas가 리스트

**파일**: `backend/tests/test_live_smoke.py`

### 2-2. 결과 일관성 테스트

동일 아이디어를 2회 실행하여 **구조적 일관성**을 확인합니다.

> AI 특성상 정확한 값 일치는 불가능하므로, 구조와 범위의 일관성만 검증합니다.

**검증 항목**:
- 두 실행 모두 동일한 키 구조
- verdict가 2회 모두 유효한 값 (GO/PIVOT/KILL)
- overall_score가 2회 모두 0-100 범위
- competition_level이 2회 모두 유효한 값
- scores의 각 항목이 2회 모두 0-100 범위

**파일**: `backend/tests/test_live_consistency.py`

---

## 3. 수동 테스트 (자동화 부적합)

아래 항목은 AI 출력의 주관적 품질 및 UI/UX 경험을 평가하므로 자동화 대신 수동 체크리스트로 관리합니다.

### 3-1. AI 출력 품질 평가

| 체크 항목 | 평가 기준 |
|---|---|
| 경쟁 제품 검색 결과 관련성 | 검색된 제품이 실제로 아이디어와 경쟁 관계인가? |
| Devil's Arguments 품질 | 3가지 관점(이미 있는데/이게 되겠어/누가 써)이 실제로 의미 있는 비판인가? |
| 기술 요구사항 현실성 | 나열된 기술 스택/API가 실제로 필요한 것들인가? |
| 최종 판정 합리성 | GO/PIVOT/KILL 판정이 분석 결과와 논리적으로 일치하는가? |
| pivot_suggestions 실용성 | 제안된 대안이 실현 가능한 방향인가? |

### 3-2. UI/UX 경험

| 체크 항목 | 평가 기준 |
|---|---|
| SSE 스트리밍 체감 | 각 step이 순차적으로 자연스럽게 표시되는가? |
| 애니메이션 | fade-in, slide-up, verdict-reveal이 부드러운가? |
| 반응형 레이아웃 | 모바일/태블릿 화면에서 깨지지 않는가? |
| 다크 모드 | 모든 컴포넌트에서 색상/대비가 적절한가? |
| 에러 상태 UI | 네트워크 오류 시 에러 배너 + 재시도 버튼이 정상 작동하는가? |
| 색상 의미 일관성 | GO=초록, PIVOT=노랑, KILL=빨강이 모든 곳에서 일관되는가? |

### 3-3. 엣지 케이스 (사용자 행동)

| 시나리오 | 확인 포인트 |
|---|---|
| 매우 모호한 아이디어 ("앱 만들기") | 크래시 없이 결과 반환 |
| 한국어 전용 아이디어 | 정상 검색 + 분석 |
| 영어 전용 아이디어 | 정상 검색 + 분석 |
| 특수문자 포함 아이디어 | XSS 없이 정상 처리 |
| 분석 중 새로고침 | 상태 초기화, 에러 없음 |
| 빠른 연속 제출 | race condition 없음 |

---

## 4. 구현 계획

### 테스트 인프라 설정

1. **Backend**: `pytest` + `pytest-asyncio` + `httpx` (TestClient) 설치
2. `backend/tests/` 디렉터리 생성, `conftest.py`에 공통 fixtures 정의
3. `pytest.ini` 또는 `pyproject.toml`에 마커 설정 (`live_api`)

### 파일 구조

```
backend/
├── tests/
│   ├── conftest.py              # 공통 fixtures (mock 응답 데이터, 분석기 인스턴스)
│   ├── test_unit.py             # 1-1: 단위 테스트
│   ├── test_integration.py      # 1-2: 통합 테스트 (모킹)
│   ├── test_api.py              # 1-3: API 엔드포인트 테스트
│   ├── test_schema.py           # 1-4: 스키마 검증 테스트
│   ├── test_live_smoke.py       # 2-1: 실제 API 스모크 테스트
│   └── test_live_consistency.py # 2-2: 결과 일관성 테스트
├── pytest.ini                   # pytest 설정 + 마커 정의
└── requirements.txt             # pytest, pytest-asyncio 추가
```

### 실행 방법

```bash
# 모킹 기반 전체 테스트 (API 키 불필요)
cd backend && pytest -v --ignore=tests/test_live_*.py

# 실제 API 스모크 테스트 (API 키 필요)
cd backend && pytest -v -m live_api

# 전체 테스트
cd backend && pytest -v
```

### 추가 의존성

```
pytest==8.3.4
pytest-asyncio==0.25.0
```
