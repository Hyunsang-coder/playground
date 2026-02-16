import type { AnalysisResult } from "../types";

export const DEMO_RESULT: AnalysisResult = {
  videoId: "demo_video_id",
  title: '충격! 이것만 먹으면 한 달에 10kg 빠진다고?! ㄷㄷ 실화임',
  channelName: "건강채널 데모",
  thumbnailUrl: "",

  trustScore: 32,
  clickbaitRisk: 68,
  verdict: "clickbait",

  transcriptAnalysis: {
    claims: [
      {
        claim: "한 달에 10kg 감량 가능",
        evidence:
          "영상 내에서는 '개인차가 크다'며 평균 2~3kg 감량 사례만 언급합니다.",
        score: 15,
        met: false,
      },
      {
        claim: "'이것만 먹으면' 된다는 단일 식품 해법",
        evidence:
          "실제로는 운동 병행과 식단 조절을 함께 권장하고 있어 제목의 '이것만'과 다릅니다.",
        score: 20,
        met: false,
      },
      {
        claim: "충격적인 결과/실화",
        evidence:
          "특별히 충격적인 데이터나 실험 결과는 제시되지 않았으며, 일반적인 다이어트 팁 수준입니다.",
        score: 25,
        met: false,
      },
    ],
    overallScore: 20,
    summary:
      "제목이 약속한 극적인 다이어트 효과는 영상 내용과 큰 차이가 있습니다.",
  },

  commentAnalysis: {
    totalAnalyzed: 85,
    keywordResult: {
      negativeCount: 28,
      positiveCount: 12,
      negativeRatio: 0.7,
    },
    aiResult: {
      mismatchComplaints: 22,
      satisfied: 8,
      adComplaints: 15,
    },
    commentScore: 30,
  },

  metadataAnalysis: {
    titleSensationalism: 55,
    clickbaitWordsFound: ["충격", "ㄷㄷ", "실화"],
    excessivePunctuation: 3,
    emojiCount: 0,
    likeViewRatio: 0.012,
    metaScore: 45,
  },

  analysisMode: "fixture",
  weights: { transcript: 0.5, comment: 0.3, metadata: 0.2 },

  summary:
    "제목은 극적인 다이어트 효과를 약속하지만, 실제 영상은 일반적인 건강 팁을 소개합니다. 댓글에서도 '낚시' 불만이 다수 확인됩니다.",

  source: "fixture",
};
