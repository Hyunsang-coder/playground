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
  topics?: string[];
  forks?: number;
  open_issues?: number;
  readme_snippet?: string;
  recent_commits?: number;
  last_commit_date?: string;
}

export interface WebSearchResult {
  competitors: Competitor[];
  raw_count: number;
  summary: string;
}

export interface GitHubSearchResult {
  repos: GitHubRepo[];
  total_count: number;
  strategies_used?: string[];
  summary: string;
}

export interface TechRequirement {
  name: string;
  available: boolean;
  difficulty: "easy" | "medium" | "hard";
  note: string;
  alternatives?: string;
}

export interface ImplementationStep {
  step: string;
  estimated_hours: number;
  complexity: "low" | "medium" | "high";
  description: string;
}

export interface RequiredAPI {
  name: string;
  purpose: string;
  free_tier: boolean;
  rate_limit_concern: boolean;
  alternative: string;
}

export interface ComplexityBreakdown {
  frontend?: "low" | "medium" | "high";
  backend?: "low" | "medium" | "high";
  ai_ml?: "none" | "low" | "medium" | "high";
  data?: "low" | "medium" | "high";
  infra?: "low" | "medium" | "high";
}

export interface FeasibilityResult {
  overall_feasibility: "possible" | "partial" | "difficult";
  score: number;
  tech_requirements: TechRequirement[];
  key_risks: string[];
  time_estimate: string;
  summary: string;
  implementation_steps?: ImplementationStep[];
  required_apis?: RequiredAPI[];
  complexity_breakdown?: ComplexityBreakdown;
  time_feasible?: boolean;
  skill_level?: "junior" | "mid" | "senior" | "expert";
}

export interface ExistingSolution {
  name: string;
  similarity: number;
  weakness: string;
  is_active?: boolean;
  overlap_features?: string[];
}

export interface DifferentiationResult {
  competition_level: "blue_ocean" | "moderate" | "red_ocean";
  competition_score: number;
  existing_solutions: ExistingSolution[];
  unique_angles: string[];
  devil_arguments: string[];
  pivot_suggestions: string[];
  summary: string;
  market_gap?: string;
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
  strengths?: string[];
  weaknesses?: string[];
}

export type StepStatus = "pending" | "loading" | "done";

export interface AnalysisStep {
  step: number;
  title: string;
  description: string;
  status: StepStatus;
  result?: unknown;
}
