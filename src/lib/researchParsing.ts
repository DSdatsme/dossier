export interface ParsedFact {
  section: string;
  content: string;
  sourceDetail: string;
}

export const VALID_SECTIONS = new Set([
  "companySnapshot",
  "fundingNews",
  "companyAtLocation",
  "cultureValues",
  "roleSpecifics",
  "techStack",
  "compensation",
  "redFlags",
  "sources",
]);

export function extractJsonBlocks(text: string): string[] {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  if (blocks.length > 0) return blocks;

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return [];

  return [text.slice(firstBrace, lastBrace + 1)];
}

/**
 * Attempts to parse a single candidate JSON block and validate its shape.
 * Returns `null` if the candidate isn't valid JSON or isn't shaped like a
 * research-facts payload. Returns an array (possibly empty) of validated
 * facts if the candidate was validly shaped.
 */
function tryParseCandidate(jsonBlock: string): ParsedFact[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("facts" in parsed) ||
    !Array.isArray((parsed as { facts: unknown }).facts)
  ) {
    return null;
  }

  const facts: ParsedFact[] = [];
  for (const raw of (parsed as { facts: unknown[] }).facts) {
    if (
      typeof raw === "object" &&
      raw !== null &&
      "section" in raw &&
      "content" in raw &&
      typeof (raw as { section: unknown }).section === "string" &&
      typeof (raw as { content: unknown }).content === "string" &&
      (raw as { content: string }).content.trim().length > 0 &&
      VALID_SECTIONS.has((raw as { section: string }).section)
    ) {
      const record = raw as { section: string; content: string; sourceDetail?: unknown };
      facts.push({
        section: record.section,
        content: record.content,
        sourceDetail: typeof record.sourceDetail === "string" ? record.sourceDetail : "web research",
      });
    }
  }

  return facts;
}

export function parseResearchFacts(resultText: string): ParsedFact[] {
  const candidates = extractJsonBlocks(resultText);

  let emptyValidResult: ParsedFact[] | null = null;

  for (let i = candidates.length - 1; i >= 0; i--) {
    const result = tryParseCandidate(candidates[i]);
    if (result === null) continue;
    if (result.length > 0) return result;
    if (emptyValidResult === null) emptyValidResult = result;
  }

  return emptyValidResult ?? [];
}
