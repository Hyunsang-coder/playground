export interface Competitor {
  title: string;
  url: string;
  snippet: string;
}

export interface GitHubRepo {
  name: string;
  description: string;
  stars: number;
  url: string;
  language: string;
  updated: string;
}

export interface WebSearchResult {
  competitors: Competitor[];
  raw_count: number;
  summary: string;
}

export interface GitHubSearchResult {
  repos: GitHubRepo[];
  total_count: number;
  summary: string;
}

export interface TechRequirement {
  name: string;
  available: boolean;
  difficulty: "easy" | "medium" | "hard";
  note: string;
}

export interface FeasibilityResult {
  overall_feasibility: "possible" | "partial" | "difficult";
  score: number;
  vibe_coding_difficulty: "easy" | "medium" | "hard";
  bottlenecks: string[];
  tech_requirements: TechRequirement[];
  key_risks: string[];
  time_estimate: string;
  summary: string;
}

export interface ExistingSolution {
  name: string;
  similarity: number;
  weakness: string;
}

export interface DifferentiationResult {
  competition_level: "blue_ocean" | "moderate" | "red_ocean";
  competition_score: number;
  existing_solutions: ExistingSolution[];
  unique_angles: string[];
  devil_arguments: string[];
  pivot_suggestions: string[];
  summary: string;
}

export interface VerdictScores {
  competition: number;
  feasibility: number;
  differentiation: number;
  timing: number;
}

export interface VerdictResult {
  verdict: "GO" | "PIVOT" | "KILL";
  confidence: number;
  overall_score: number;
  scores: VerdictScores;
  one_liner: string;
  recommendation: string;
  alternative_ideas: string[];
}

export type StepStatus = "pending" | "loading" | "done";

export interface AnalysisStep {
  step: number;
  title: string;
  description: string;
  status: StepStatus;
  result?: unknown;
  progressText?: string;
}
