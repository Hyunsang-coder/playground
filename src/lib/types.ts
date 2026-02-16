// === YouTube 데이터 ===

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string; // ISO 8601 (PT10M30S)
  thumbnailUrl: string;
  tags: string[];
  categoryId: string;
}

export interface VideoComment {
  text: string;
  likeCount: number;
  publishedAt: string;
  isAuthorReply: boolean;
}

export interface TranscriptSegment {
  text: string;
  offset: number; // ms
  duration: number;
}

// === 분석 결과 ===

export interface ClaimVerification {
  claim: string; // 제목에서 추출한 약속
  evidence: string; // 자막에서 찾은 근거
  score: number; // 0-100 (높을수록 약속 충족)
  met: boolean;
}

export interface TranscriptAnalysis {
  claims: ClaimVerification[];
  overallScore: number; // 0-100
  summary: string;
}

export interface CommentAnalysis {
  totalAnalyzed: number;
  keywordResult: {
    negativeCount: number;
    positiveCount: number;
    negativeRatio: number;
  };
  aiResult?: {
    mismatchComplaints: number;
    satisfied: number;
    adComplaints: number;
  };
  commentScore: number; // 0-100
}

export interface MetadataAnalysis {
  titleSensationalism: number;
  clickbaitWordsFound: string[];
  excessivePunctuation: number;
  emojiCount: number;
  likeViewRatio: number;
  metaScore: number; // 0-100
}

// === 종합 결과 ===

export type AnalysisMode = "full" | "no_transcript" | "no_comments" | "fixture";

export type Verdict = "trustworthy" | "suspect" | "clickbait";

export interface AnalysisResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;

  // 종합 점수
  trustScore: number; // 0-100 (높을수록 신뢰)
  clickbaitRisk: number; // 100 - trustScore
  verdict: Verdict;

  // 3개 레이어 상세
  transcriptAnalysis: TranscriptAnalysis | null;
  commentAnalysis: CommentAnalysis | null;
  metadataAnalysis: MetadataAnalysis;

  // 가중치 정보
  analysisMode: AnalysisMode;
  weights: { transcript: number; comment: number; metadata: number };

  // 종합 요약
  summary: string;

  source: "youtube" | "fixture";
}

// === 영상 유형 ===

export type VideoType = "normal" | "music" | "live" | "shorts" | "long";

export interface VideoTypeInfo {
  type: VideoType;
  skipTranscript: boolean; // 자막 분석 스킵 여부
  sampleRatio: number; // 자막 샘플링 비율 (0-1)
  reason?: string;
}

// === 검색 ===

export interface SearchResultItem {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  publishedAt: string;
  description: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  // 비동기로 채워지는 신뢰도 점수
  trustScore?: number;
  verdict?: Verdict;
  analysisStatus: "pending" | "loading" | "done" | "error";
}

// === API 요청/응답 ===

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeSuccessResponse {
  analysisId: string;
  result: AnalysisResult;
}

export interface AnalyzeErrorResponse {
  error: {
    code: "INVALID_URL" | "FETCH_FAILED" | "LLM_FAILED" | "INTERNAL";
    message: string;
  };
}

export interface SearchRequest {
  query: string;
  maxResults?: number;
}

export interface SearchSuccessResponse {
  results: SearchResultItem[];
}

export interface SearchErrorResponse {
  error: {
    code: "INVALID_QUERY" | "SEARCH_FAILED" | "INTERNAL";
    message: string;
  };
}
