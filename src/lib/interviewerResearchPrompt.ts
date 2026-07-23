import { extractJsonBlocks } from "./researchParsing";

export interface InterviewerResearchInput {
  name: string;
  companyName: string;
  knownRole: string | null;
}

export function buildInterviewerResearchPrompt(input: InterviewerResearchInput): string {
  const roleNote = input.knownRole ? ` (role: "${input.knownRole}")` : "";
  return `Research "${input.name}"${roleNote}, an interviewer at "${input.companyName}", to build a richer profile for someone preparing to interview with them.

Try multiple search strategies rather than stopping after one — LinkedIn profiles for this kind of search are frequently blocked from direct fetching, so do not rely on it alone. Also check the company's team/about page, conference talk bios, GitHub, published articles or blog posts, and X/Twitter.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"role": "<their role/title, or null if not confidently found>", "tenure": "<how long they've been there, or null>", "background": "<one short sentence on relevant prior experience, or null>"}

Never fabricate — use null for anything you cannot confidently find, rather than guessing.`;
}

export interface ParsedInterviewerResearch {
  role: string | null;
  tenure: string | null;
  background: string | null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function parseInterviewerResearch(resultText: string): ParsedInterviewerResearch | null {
  const candidates = extractJsonBlocks(resultText);
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(candidates[i]) as unknown;
      if (typeof parsed !== "object" || parsed === null) continue;
      const record = parsed as Record<string, unknown>;
      return {
        role: optionalString(record.role),
        tenure: optionalString(record.tenure),
        background: optionalString(record.background),
      };
    } catch {
      continue;
    }
  }
  return null;
}
