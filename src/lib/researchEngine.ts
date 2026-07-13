import { spawn } from "node:child_process";
import { prisma } from "./db";
import { buildResearchPrompt, type ResearchInput } from "./researchPrompt";
import { parseResearchFacts } from "./researchParsing";

export type { ResearchInput };

export interface ResearchEngine {
  research(input: ResearchInput): Promise<void>;
}

export type CliRunner = (prompt: string, threadId: string) => Promise<string>;

const MAX_TURNS = 15;
const TIMEOUT_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

export class ClaudeCodeCliResearchEngine implements ResearchEngine {
  constructor(private runner: CliRunner = spawnClaudeCli) {}

  async research(input: ResearchInput): Promise<void> {
    console.log(`[research] starting for thread ${input.threadId} (${input.companyName})`);
    try {
      const prompt = buildResearchPrompt(input);

      let stdout: string;
      try {
        stdout = await this.runner(prompt, input.threadId);
      } catch (error) {
        await markFailed(input.threadId, describeError(error));
        return;
      }

      let resultText: string;
      try {
        const envelope = JSON.parse(stdout) as { result?: unknown };
        if (typeof envelope.result !== "string") {
          await markFailed(input.threadId, "Research run returned no result text.");
          return;
        }
        resultText = envelope.result;
      } catch {
        await markFailed(input.threadId, "Research run's output was not valid JSON.");
        return;
      }

      const facts = parseResearchFacts(resultText);
      if (facts.length === 0) {
        await markFailed(input.threadId, "No facts could be extracted from the research run.");
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

export function spawnClaudeCli(prompt: string, threadId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", prompt, "--output-format", "json", "--allowedTools", "WebSearch,WebFetch", "--max-turns", String(MAX_TURNS)],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let elapsedMs = 0;

    const heartbeat = setInterval(() => {
      elapsedMs += HEARTBEAT_MS;
      console.log(`[research] thread ${threadId}: still running (${elapsedMs / 1000}s elapsed)`);
    }, HEARTBEAT_MS);

    const stopTimers = () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
    };

    const timer = setTimeout(() => {
      stopTimers();
      child.kill("SIGKILL");
      reject(new Error("Research run timed out."));
    }, TIMEOUT_MS);

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
        const output = [stderr.trim(), stdout.trim()].filter(Boolean).join(" | ").slice(0, 500);
        reject(new Error(`claude CLI exited with code ${code}: ${output}`));
        return;
      }
      resolve(stdout);
    });
  });
}
