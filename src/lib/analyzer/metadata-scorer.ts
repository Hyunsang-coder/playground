import type { VideoMetadata, MetadataAnalysis } from "../types";

const CLICKBAIT_WORDS = [
  "충격", "경악", "레전드", "ㄷㄷ", "실화", "미쳤",
  "대박", "난리", "논란", "절대", "필수", "역대급",
  "소름", "전설", "극혐", "ㅋㅋ", "헐", "반전",
];

export function calculateMetaScore(meta: VideoMetadata): MetadataAnalysis {
  let score = 100;

  // 자극적 단어 감점
  const found = CLICKBAIT_WORDS.filter((w) => meta.title.includes(w));
  score -= found.length * 10;

  // 과도한 문장부호 감점
  const punctuation = (meta.title.match(/[!?]/g) || []).length;
  score -= Math.min(punctuation * 5, 20);

  // 이모지 감점 (surrogate pairs 기반)
  const emojiCount = Array.from(meta.title).filter(
    (c) => (c.codePointAt(0) ?? 0) > 0xffff
  ).length;
  score -= Math.min(emojiCount * 5, 15);

  // 좋아요/조회수 비율
  const likeRatio = meta.likeCount / Math.max(meta.viewCount, 1);
  if (likeRatio < 0.01) score -= 20;
  else if (likeRatio < 0.02) score -= 10;

  // 대문자 비율 (영문 제목)
  const letters = meta.title.match(/[a-zA-Z]/g) || [];
  if (letters.length > 5) {
    const upperRatio =
      (meta.title.match(/[A-Z]/g) || []).length / letters.length;
    if (upperRatio > 0.5) score -= 10;
  }

  return {
    titleSensationalism: Math.max(0, 100 - score),
    clickbaitWordsFound: found,
    excessivePunctuation: punctuation,
    emojiCount,
    likeViewRatio: likeRatio,
    metaScore: Math.max(0, Math.min(100, score)),
  };
}
