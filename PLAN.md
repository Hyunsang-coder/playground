# YouTube 낚시 판별기 (Clickbait Detector) — 실행 플랜

## 1. 프로젝트 개요

유튜브 URL을 입력하면 제목이 약속한 내용과 실제 영상 내용의 일치도를 3중 분석(자막+댓글+메타데이터)으로 판별하는 웹 서비스.

핵심 메시지:
- 제목의 약속(claim)을 분해하여 각각을 자막에서 검증
- 댓글의 감성 분석으로 시청자 반응 확인
- 메타데이터 자극성 정량 분석
- "왜 이 점수인가"를 약속별로 설명 가능

해커톤 정보:
- 일시: 2026년 2월 21일(토), 개발 시간 4시간 (13:20-17:20)
- 심사: 실용성(25) + 기술 완성도(25) + AI 활용도(25) + UX(20) + 차별성(5 가산)
- 발표: 2-3분

---

## 2. 기술 스택

| 구분 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript | 풀스택 구현 |
| UI | Tailwind CSS + Recharts + lucide-react | 다크 모드 기본 |
| YouTube | googleapis (Data API v3) | 메타데이터+댓글 |
| 자막 | youtube-transcript | 자막 추출 |
| AI | Anthropic Claude API | 자막/댓글 분석 |
| 검증 | zod | LLM JSON 스키마 검증 |

---

## 3. 3중 분석 파이프라인

### Layer 1: 자막 분석 (가중치 50%)
- LLM 1회 호출 — 제목에서 약속(claim) 최대 5개 추출
- 각 약속을 자막 내용과 대조하여 충족 여부 + 근거 제시
- 약속별 0-100점 + 전체 overall_score

### Layer 2: 댓글 분석 (가중치 30%)
- Stage 1: 키워드 필터링 (코드, 즉시)
- Stage 2: AI 정밀 분석 (댓글 20개 이상일 때만)
- 최종 점수: 키워드 50% + AI 50%

### Layer 3: 메타데이터 분석 (가중치 20%)
- 순수 코드 계산 (AI 호출 없음)
- 자극적 단어, 과도한 문장부호, 이모지, 좋아요/조회수 비율

### 종합 점수
- trustScore >= 70: trustworthy (신뢰)
- trustScore 40-69: suspect (의심)
- trustScore < 40: clickbait (낚시)

---

## 4. Fallback 전략

1. YouTube API 실패 → fixture 데이터 반환
2. 자막 없음 → 가중치 재분배 (댓글 60% + 메타 40%)
3. LLM 실패 → zod 재시도 → 메타데이터+키워드 only
4. 전체 실패 → fixture + "샘플 데이터 모드" 배지

---

## 5. 환경변수

```bash
ANTHROPIC_API_KEY=           # Claude API 키
YOUTUBE_API_KEY=             # YouTube Data API v3 키
TRANSCRIPT_MAX_LENGTH=8000   # 자막 최대 글자수
LLM_MAX_CONCURRENCY=2       # 동시 LLM 호출 수
```
