import { spawn } from "node:child_process";
import { prisma } from "./db";
import { buildResearchPrompt, type ResearchInput } from "./researchPrompt";
import { parseResearchFacts } from "./researchParsing";

export type { ResearchInput };

export interface ResearchEngine {
  research(input: ResearchInput): Promise<void>;
}

export type CliRunner = (prompt: string) => Promise<string>;

const MAX_TURNS = 15;
const TIMEOUT_MS = 3 * 60 * 1000;

export class ClaudeCodeCliResearchEngine implements ResearchEngine {
  constructor(private runner: CliRunner = spawnClaudeCli) {}

  async research(input: ResearchInput): Promise<void> {
    const prompt = buildResearchPrompt(input);

    let stdout: string;
    try {
      stdout = await this.runner(prompt);
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
  }
}

async function markFailed(threadId: string, message: string): Promise<void> {
  await prisma.thread.update({
    where: { id: threadId },
    data: { researchStatus: "FAILED", researchError: message },
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error during research.";
}

export function spawnClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", prompt, "--output-format", "json", "--allowedTools", "WebSearch,WebFetch", "--max-turns", String(MAX_TURNS)],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
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
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
  });
}
