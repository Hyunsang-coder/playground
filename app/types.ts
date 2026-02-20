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
  vibe_coding_difficulty?: "easy" | "medium" | "hard";
  bottlenecks: string[] | Bottleneck[];
  data_availability?: DataAvailabilityResult;
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
  is_exact_match_found: boolean;
  exact_match_repo?: GitHubRepo;
  summary: string;
}

export interface MarketAndDifferentiationResult {
  web: WebSearchResult;
  github: GitHubSearchResult;
  differentiation: DifferentiationResult;
}

export interface VerdictScores {
  competition: number;
  feasibility: number;
  differentiation: number;
  timing: number;
}

export interface VerdictResult {
  verdict: "GO" | "PIVOT" | "KILL" | "FORK";
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

// --- Data Availability (Step 3 확장) ---

export interface DataSource {
  name: string;
  has_official_api: boolean;
  crawlable: boolean;
  evidence_url?: string;
  blocking: boolean;
  note: string;
}

export interface LibraryCheck {
  name: string;
  available_on_npm: boolean;
  package_name?: string;
  note: string;
}

export interface DataAvailabilityResult {
  data_sources: DataSource[];
  libraries: LibraryCheck[];
  has_blocking_issues: boolean;
}

export type BottleneckType =
  | "api_unavailable"
  | "auth_complexity"
  | "data_structure_unknown"
  | "realtime_required"
  | "no_library"
  | "complex_algorithm"
  | "binary_processing"
  | "existing_open_source";

export interface Bottleneck {
  type: BottleneckType;
  description: string;
  severity: "high" | "medium";
  suggestion: string;
}
