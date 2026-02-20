type SourceEvidenceInput = {
  urls: string[];
  snippets: string[];
  robotsDisallowAll?: boolean;
  robotsCheckedDomain?: string;
};

type SourceRuleOutput = {
  has_official_api: boolean;
  crawlable: boolean;
  blocking: boolean;
  evidence_url?: string;
  note: string;
};

export type NpmSearchCandidate = {
  name: string;
  description: string;
  keywords: string[];
  score: number;
};

export type NpmSelection = {
  package_name?: string;
  confident: boolean;
  note: string;
};

const API_TEXT_POSITIVE_PATTERNS = [
  /\bapi documentation\b/i,
  /\bapi docs?\b/i,
  /\bapi reference\b/i,
  /\bdeveloper portal\b/i,
  /\bopen api\b/i,
  /\bopenapi\b/i,
  /\bget api key\b/i,
  /\bpublic api\b/i,
  /\brest api\b/i,
  /\bgraphql api\b/i,
  /\bswagger\b/i,
];

const API_TEXT_NEGATIVE_PATTERNS = [
  /\bno api\b/i,
  /\bwithout api\b/i,
  /\bapi is not available\b/i,
  /\bprivate api\b/i,
  /\bpartner api\b/i,
  /\brequires? partnership\b/i,
  /\bclosed beta\b/i,
  /\binvite[- ]only\b/i,
  /\bcontact sales\b/i,
  /\bcontact us\b/i,
  /\benterprise only\b/i,
  /공식\s*api\s*없/i,
  /api\s*미지원/i,
  /파트너\s*전용/i,
];

const LEGAL_BLOCK_PATTERNS = [
  /\bno scraping\b/i,
  /\bscraping (is )?prohibited\b/i,
  /\bdo not scrape\b/i,
  /\bautomated access (is )?prohibited\b/i,
  /\bunauthorized scraping\b/i,
  /\brobots\.txt disallow\b/i,
  /크롤링\s*금지/i,
  /스크래핑\s*금지/i,
  /자동화된\s*수집\s*금지/i,
  /무단\s*수집\s*금지/i,
];

const API_URL_HINTS = [
  "developer.",
  "developers.",
  "/developer",
  "/developers",
  "/devportal",
  "/api",
  "openapi",
  "swagger",
];

const STOP_WORDS = new Set([
  "npm",
  "package",
  "packages",
  "library",
  "libraries",
  "javascript",
  "typescript",
  "node",
  "nodejs",
  "react",
  "sdk",
  "tool",
  "tools",
  "for",
  "and",
  "the",
]);

function countPatternHits(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 1;
  }
  return hits;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)));
}

function isLikelyApiUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return API_URL_HINTS.some((hint) => lower.includes(hint));
}

function pickEvidenceUrl(urls: string[], preferApiUrl: boolean): string | undefined {
  const deduped = unique(urls);
  if (deduped.length === 0) return undefined;

  if (preferApiUrl) {
    const apiUrl = deduped.find((url) => isLikelyApiUrl(url));
    if (apiUrl) return apiUrl;
  }

  return deduped[0];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function normalizePackageName(value: string): string {
  return value.trim().toLowerCase();
}

export function evaluateDataSourceWithRules(evidence: SourceEvidenceInput): SourceRuleOutput {
  const urls = unique(evidence.urls);
  const snippets = unique(evidence.snippets);
  const urlText = urls.join("\n").toLowerCase();
  const snippetText = snippets.join("\n").toLowerCase();
  const combinedText = `${urlText}\n${snippetText}`;

  const apiUrlSignals = urls.filter((url) => isLikelyApiUrl(url)).length;
  const apiPositiveHits = countPatternHits(combinedText, API_TEXT_POSITIVE_PATTERNS) + (apiUrlSignals > 0 ? 1 : 0);
  const apiNegativeHits = countPatternHits(combinedText, API_TEXT_NEGATIVE_PATTERNS);
  const legalBlockHits = countPatternHits(combinedText, LEGAL_BLOCK_PATTERNS);

  const hasOfficialApi = apiPositiveHits >= 2 && apiNegativeHits === 0;
  const crawlSurfaceCount = urls.filter((url) => !isLikelyApiUrl(url)).length;
  const crawlSignals = crawlSurfaceCount > 0 || snippets.length > 0;
  const crawlBlockedByPolicy = legalBlockHits > 0 || evidence.robotsDisallowAll === true;
  const crawlable = !hasOfficialApi && crawlSignals && !crawlBlockedByPolicy;
  const blocking = !hasOfficialApi && !crawlable;

  let note = "공식 API/크롤링 근거 부족 (수동 확인 필요)";
  if (hasOfficialApi) {
    note = "공식 API 문서/개발자 포털 근거 확인";
  } else if (legalBlockHits > 0) {
    note = "약관/정책에서 자동 수집 제한 신호 감지";
  } else if (evidence.robotsDisallowAll) {
    note = evidence.robotsCheckedDomain
      ? `robots.txt(${evidence.robotsCheckedDomain})에서 전체 크롤링 제한 신호`
      : "robots.txt에서 전체 크롤링 제한 신호";
  } else if (crawlable) {
    note = "공개 웹 근거 확인, 크롤링 기반 접근 가능";
  }

  return {
    has_official_api: hasOfficialApi,
    crawlable,
    blocking,
    evidence_url: pickEvidenceUrl(urls, hasOfficialApi),
    note,
  };
}

export function selectNpmCandidate(query: string, candidates: NpmSearchCandidate[]): NpmSelection {
  const safeCandidates = candidates.filter((candidate) => candidate.name.trim().length > 0);
  if (safeCandidates.length === 0) {
    return {
      confident: false,
      note: "npm 검색 결과 없음",
    };
  }

  const normalizedQuery = normalizePackageName(query);
  const queryTokens = tokenize(query);

  const scored = safeCandidates.map((candidate) => {
    const normalizedName = normalizePackageName(candidate.name);
    const candidateText = `${candidate.name} ${candidate.description} ${(candidate.keywords || []).join(" ")}`;
    const candidateTokens = tokenize(candidateText);

    const tokenOverlap = queryTokens.filter((token) => {
      return candidateTokens.some((candidateToken) => candidateToken === token || candidateToken.includes(token) || token.includes(candidateToken));
    }).length;

    const exactMatch = normalizedName === normalizedQuery;
    const nearNameMatch =
      normalizedName.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedName) ||
      queryTokens.some((token) => normalizedName.includes(token));

    const score =
      (exactMatch ? 5 : 0) +
      (nearNameMatch ? 2 : 0) +
      tokenOverlap * 1.5 +
      Math.min(candidate.score, 1);

    return {
      candidate,
      score,
      exactMatch,
      tokenOverlap,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const requiredOverlap = queryTokens.length >= 2 ? 2 : 1;
  const requiredScore = queryTokens.length >= 2 ? 0.5 : 0.7;
  const confident =
    best.exactMatch ||
    (best.tokenOverlap >= requiredOverlap && best.candidate.score >= requiredScore);

  if (!confident) {
    return {
      confident: false,
      package_name: best.candidate.name,
      note: `검색 최상위 후보는 ${best.candidate.name}이나 정확도 근거가 약함`,
    };
  }

  return {
    confident: true,
    package_name: best.candidate.name,
    note: `npm 검색 상위 후보 ${best.candidate.name} (score ${best.candidate.score.toFixed(2)})`,
  };
}
