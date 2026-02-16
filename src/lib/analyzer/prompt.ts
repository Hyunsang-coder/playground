export const TRANSCRIPT_ANALYSIS_PROMPT = `당신은 유튜브 영상 검증 분석가입니다.

아래 유튜브 영상의 제목과 자막을 비교하여, 제목이 시청자에게 한 약속(claims)이 실제 영상 내용과 일치하는지 분석하세요.

[제목]: {title}

[자막]:
{transcript}

다음 단계를 수행하세요:
1. 제목에서 시청자에게 약속하거나 암시하는 내용(claims)을 추출하세요 (최대 5개)
2. 각 약속에 대해 자막에서 근거를 찾아 충족 여부를 판단하세요
3. 각 약속에 0~100점을 부여하세요 (100 = 완전 충족, 0 = 전혀 충족하지 않음)
4. 전체 overall_score를 계산하세요
5. 한 줄 요약을 작성하세요

반드시 아래 JSON 형식으로만 응답하세요. 마크다운, 코드블록, 설명문 없이 순수 JSON만 출력하세요:
{"claims":[{"claim":"약속 내용","evidence":"자막에서 찾은 근거","score":0,"met":false}],"overall_score":0,"summary":"한 줄 요약"}`;

export const COMMENT_ANALYSIS_PROMPT = `당신은 유튜브 댓글 분석가입니다.

아래 유튜브 영상의 제목과 시청자 댓글들을 분석하여, 시청자들이 영상 내용에 대해 어떻게 느끼는지 파악하세요.

[제목]: {title}

[댓글들]:
{comments}

다음을 분석하세요:
1. 제목과 내용이 다르다고 불만을 표현하는 댓글 수 (mismatch_complaints)
2. 영상에 만족하는 댓글 수 (satisfied)
3. 광고/협찬에 불만을 표현하는 댓글 수 (ad_complaints)
4. 전체적인 댓글 기반 신뢰도 점수 (0-100, 높을수록 신뢰)

반드시 아래 JSON 형식으로만 응답하세요. 마크다운, 코드블록, 설명문 없이 순수 JSON만 출력하세요:
{"mismatch_complaints":0,"satisfied":0,"ad_complaints":0,"comment_score":0}`;

export function buildTranscriptPrompt(
  title: string,
  transcript: string
): string {
  return TRANSCRIPT_ANALYSIS_PROMPT.replace("{title}", title).replace(
    "{transcript}",
    transcript
  );
}

export function buildCommentPrompt(
  title: string,
  comments: string[]
): string {
  const numbered = comments
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");
  return COMMENT_ANALYSIS_PROMPT.replace("{title}", title).replace(
    "{comments}",
    numbered
  );
}
