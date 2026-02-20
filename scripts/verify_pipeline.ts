
import { IdeaAnalyzer } from "../app/api/analyze/analyzer";
import * as fs from "fs";
import * as path from "path";

type Step1Result = {
    competitors?: unknown[];
    github_repos?: unknown[];
};

type Step2DataSource = {
    name?: string;
    has_official_api?: boolean;
    crawlable?: boolean;
    blocking?: boolean;
    note?: string;
};

type Step2Result = {
    data_availability?: {
        data_sources?: Step2DataSource[];
    };
};

// Manually load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
            process.env[key] = value;
        }
    });
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const tavilyKey = process.env.TAVILY_API_KEY;
const githubToken = process.env.GITHUB_TOKEN;

if (!anthropicKey || !tavilyKey) {
    console.error("Missing API keys in .env.local");
    process.exit(1);
}

const analyzer = new IdeaAnalyzer(anthropicKey, tavilyKey, githubToken || "");

async function run() {
    const idea = "AI-powered architectural drawing generator for iPad";
    console.log(`Analyzing idea: ${idea}`);

    try {
        const generator = analyzer.analyze(idea, [1, 2, 3, 4, 5]);
        for await (const event of generator) {
            if (event.event === "step_start") {
                console.log(`\n[STEP START] ${event.data.step}: ${event.data.title}`);
            } else if (event.event === "step_progress") {
                process.stdout.write(".");
            } else if (event.event === "step_result") {
                console.log(`\n[STEP RESULT] ${event.data.step}`);
                if (event.data.step === 1) {
                    const res = (event.data.result ?? {}) as Step1Result;
                    const competitorsCount = Array.isArray(res.competitors) ? res.competitors.length : 0;
                    const githubRepoCount = Array.isArray(res.github_repos) ? res.github_repos.length : "N/A";
                    console.log(`- Web Competitors: ${competitorsCount}`);
                    console.log(`- GitHub Repos: ${githubRepoCount}`);
                } else if (event.data.step === 2) { // Feasibility & Data
                    const res = (event.data.result ?? {}) as Step2Result;
                    if (res.data_availability && Array.isArray(res.data_availability.data_sources)) {
                        console.log("- Data Sources Checked:");
                        res.data_availability.data_sources.forEach((ds) => {
                            console.log(`  * ${ds.name}: API=${ds.has_official_api}, Crawlable=${ds.crawlable}, Blocking=${ds.blocking}`);
                            console.log(`    Note: ${ds.note}`);
                        });
                    }
                }
            } else if (event.event === "done") {
                console.log("\nAnalysis Complete.");
            }
        }
    } catch (error) {
        console.error("Error running pipeline:", error);
    }
}

run();
