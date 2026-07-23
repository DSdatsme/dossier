import { spawn } from "node:child_process";
import { prisma } from "./db";
import {
  buildCompanyFundamentalsPrompt,
  buildEmployeeExperiencePrompt,
  buildRoleTeamTechPrompt,
  buildCompensationPrompt,
  buildInterviewProcessPrompt,
  buildResearchVerifyPrompt,
  type ResearchInput,
} from "./researchPrompts";
import { parseResearchFacts, type ParsedFact } from "./researchParsing";
import { mergeResearchFacts } from "./researchMerge";

export type { ResearchInput };

export interface ResearchEngine {
  research(input: ResearchInput): Promise<void>;
}

export type CliRunner = (prompt: string, threadId: string) => Promise<string>;

const MODEL = "claude-sonnet-5";
const CHAT_MAX_TURNS = 15;
const CHAT_TIMEOUT_MS = 10 * 60 * 1000;
const RESEARCH_MAX_TURNS = 30;
const RESEARCH_TIMEOUT_MS = 20 * 60 * 1000;
// The verify pass does pure judgment over already-provided JSON, with tool use
// deliberately blocked (see VERIFY_TOOLS) — it should resolve in 1-2 turns, not
// the 16-25+ turns a live-research cluster call takes.
const VERIFY_MAX_TURNS = 5;
const VERIFY_TIMEOUT_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

// --allowedTools alone does not appear to restrict tool access below whatever a
// user's ambient permission settings already allow (e.g. skipAutoPermissionPrompt) —
// --disallowedTools is what actually enforces a hard denial. The verify pass has no
// legitimate reason to touch the filesystem, shell, or network, so it gets an
// explicit deny-list instead of relying on omission.
const CLUSTER_TOOLS = { allowedTools: "WebSearch,WebFetch" };
const VERIFY_TOOLS = {
  allowedTools: "",
  disallowedTools: "Bash,WebSearch,WebFetch,Write,Edit,Read,Glob,Grep,Task,NotebookEdit,TodoWrite",
};

const CLUSTER_BUILDERS: { name: string; build: (input: ResearchInput) => string }[] = [
  { name: "company fundamentals", build: buildCompanyFundamentalsPrompt },
  { name: "employee experience", build: buildEmployeeExperiencePrompt },
  { name: "role, team & tech", build: buildRoleTeamTechPrompt },
  { name: "compensation", build: buildCompensationPrompt },
  { name: "interview process", build: buildInterviewProcessPrompt },
];

interface ResearchCallResult {
  facts: ParsedFact[];
  succeeded: boolean;
  usage: CliUsage | null;
}

interface CliUsage {
  costUsd: number;
  numTurns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

interface CliEnvelope {
  result?: unknown;
  total_cost_usd?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

function extractUsage(envelope: CliEnvelope): CliUsage | null {
  if (typeof envelope.total_cost_usd !== "number" || !envelope.usage) {
    return null;
  }
  return {
    costUsd: envelope.total_cost_usd,
    numTurns: envelope.num_turns ?? 0,
    inputTokens: envelope.usage.input_tokens ?? 0,
    outputTokens: envelope.usage.output_tokens ?? 0,
    cacheReadTokens: envelope.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: envelope.usage.cache_creation_input_tokens ?? 0,
  };
}

// Note: the CLI's `usage.server_tool_use.web_search_requests`/`web_fetch_requests`
// fields only count Anthropic's server-executed web tool, not the Claude Code CLI's
// own client-driven WebSearch/WebFetch tools — they read 0 even on calls that
// clearly searched the web, so they're intentionally not tracked here. Turn count
// is the meaningful proxy for tool-call volume in this setup.
function formatUsage(usage: CliUsage): string {
  const totalTokens = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
  return `$${usage.costUsd.toFixed(3)}, ${usage.numTurns} turns, ${totalTokens} tokens (${usage.inputTokens} in / ${usage.outputTokens} out / ${usage.cacheReadTokens} cache-read / ${usage.cacheCreationTokens} cache-write)`;
}

function sumUsage(results: ResearchCallResult[]): CliUsage {
  return results.reduce<CliUsage>(
    (total, result) => {
      const usage = result.usage;
      if (!usage) return total;
      return {
        costUsd: total.costUsd + usage.costUsd,
        numTurns: total.numTurns + usage.numTurns,
        inputTokens: total.inputTokens + usage.inputTokens,
        outputTokens: total.outputTokens + usage.outputTokens,
        cacheReadTokens: total.cacheReadTokens + usage.cacheReadTokens,
        cacheCreationTokens: total.cacheCreationTokens + usage.cacheCreationTokens,
      };
    },
    { costUsd: 0, numTurns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
  );
}

export class ClaudeCodeCliResearchEngine implements ResearchEngine {
  constructor(
    private runner: CliRunner = spawnClaudeCliForResearch,
    private verifyRunner: CliRunner = spawnClaudeCliForVerify
  ) {}

  async research(input: ResearchInput): Promise<void> {
    console.log(`[research] starting for thread ${input.threadId} (${input.companyName})`);
    try {
      const clusterResults = await Promise.all(
        CLUSTER_BUILDERS.map(({ name, build }) => this.runResearchCall(build(input), input.threadId, name, this.runner))
      );

      const merged = mergeResearchFacts(clusterResults.map((result) => result.facts));
      if (merged.length === 0) {
        await markFailed(input.threadId, "No facts could be extracted from the research run.");
        console.log(`[research] thread ${input.threadId}: TOTAL usage — ${formatUsage(sumUsage(clusterResults))}`);
        return;
      }

      const verifyResult = await this.runResearchCall(
        buildResearchVerifyPrompt(merged),
        input.threadId,
        "verification",
        this.verifyRunner
      );
      if (!verifyResult.succeeded) {
        console.error(`[research] thread ${input.threadId}: verification pass failed, keeping unverified facts`);
      }
      const facts = verifyResult.succeeded ? verifyResult.facts : merged;

      const allResults = [...clusterResults, verifyResult];
      console.log(`[research] thread ${input.threadId}: TOTAL usage across ${allResults.length} calls — ${formatUsage(sumUsage(allResults))}`);

      if (facts.length === 0) {
        await markFailed(input.threadId, "No facts survived verification.");
        return;
      }

      await prisma.fact.createMany({
        data: facts.map((fact) => ({
          threadId: input.threadId,
          section: fact.section,
          content: fact.content,
          sourceType: "RESEARCHED" as const,
          sourceDetail: fact.sourceDetail,
        })),
      });
      await prisma.thread.update({
        where: { id: input.threadId },
        data: { researchStatus: "DONE", researchError: null },
      });
      console.log(`[research] thread ${input.threadId}: wrote ${facts.length} facts, marked DONE`);
    } catch (error) {
      await markFailed(input.threadId, describeError(error)).catch(() => {
        // Thread may no longer exist (e.g. deleted mid-research) or the DB may be
        // unreachable — there is nothing further to do, but research() must never
        // reject: it runs detached from the Server Action that triggered it.
        console.error(`[research] thread ${input.threadId}: failed to record failure too (thread likely gone)`);
      });
    }
  }

  private async runResearchCall(prompt: string, threadId: string, label: string, runner: CliRunner): Promise<ResearchCallResult> {
    try {
      const stdout = await runner(prompt, threadId);
      const envelope = JSON.parse(stdout) as CliEnvelope;
      const usage = extractUsage(envelope);
      if (typeof envelope.result !== "string") {
        console.error(`[research] thread ${threadId}: ${label} returned no result text`);
        return { facts: [], succeeded: false, usage };
      }
      const facts = parseResearchFacts(envelope.result);
      console.log(`[research] thread ${threadId}: ${label} found ${facts.length} fact(s)${usage ? ` — ${formatUsage(usage)}` : ""}`);
      return { facts, succeeded: true, usage };
    } catch (error) {
      console.error(`[research] thread ${threadId}: ${label} failed: ${describeError(error)}`);
      return { facts: [], succeeded: false, usage: null };
    }
  }
}

async function markFailed(threadId: string, message: string): Promise<void> {
  console.error(`[research] thread ${threadId} FAILED: ${message}`);
  await prisma.thread.update({
    where: { id: threadId },
    data: { researchStatus: "FAILED", researchError: message },
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error during research.";
}

function spawnClaudeCliWithBudget(
  prompt: string,
  threadId: string,
  maxTurns: number,
  timeoutMs: number,
  tools: { allowedTools: string; disallowedTools?: string },
  isRetry = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--model", MODEL, "--output-format", "json", "--max-turns", String(maxTurns)];
    if (tools.allowedTools) {
      args.push("--allowedTools", tools.allowedTools);
    }
    if (tools.disallowedTools) {
      args.push("--disallowedTools", tools.disallowedTools);
    }
    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let elapsedMs = 0;

    const heartbeat = setInterval(() => {
      elapsedMs += HEARTBEAT_MS;
      console.log(`[cli] thread ${threadId}: still running (${elapsedMs / 1000}s elapsed)`);
    }, HEARTBEAT_MS);

    const stopTimers = () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
    };

    const timer = setTimeout(() => {
      stopTimers();
      child.kill("SIGKILL");
      reject(new Error("CLI run timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stopTimers();
      reject(error);
    });
    child.on("close", (code) => {
      stopTimers();
      if (code !== 0) {
        const output = [stderr.trim(), stdout.trim()].filter(Boolean).join(" | ");
        if (!isRetry) {
          console.error(`[cli] thread ${threadId}: attempt failed with exit code ${code}, retrying once. ${output.slice(0, 500)}`);
          resolve(spawnClaudeCliWithBudget(prompt, threadId, maxTurns, timeoutMs, tools, true));
          return;
        }
        reject(new Error(`claude CLI exited with code ${code}: ${output}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export const spawnClaudeCli: CliRunner = (prompt, threadId) =>
  spawnClaudeCliWithBudget(prompt, threadId, CHAT_MAX_TURNS, CHAT_TIMEOUT_MS, CLUSTER_TOOLS);

export const spawnClaudeCliForResearch: CliRunner = (prompt, threadId) =>
  spawnClaudeCliWithBudget(prompt, threadId, RESEARCH_MAX_TURNS, RESEARCH_TIMEOUT_MS, CLUSTER_TOOLS);

export const spawnClaudeCliForVerify: CliRunner = (prompt, threadId) =>
  spawnClaudeCliWithBudget(prompt, threadId, VERIFY_MAX_TURNS, VERIFY_TIMEOUT_MS, VERIFY_TOOLS);
