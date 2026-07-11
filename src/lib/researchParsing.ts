export interface ParsedFact {
  section: string;
  content: string;
  sourceDetail: string;
}

const VALID_SECTIONS = new Set([
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

export function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;

  return text.slice(firstBrace, lastBrace + 1);
}

export function parseResearchFacts(resultText: string): ParsedFact[] {
  const jsonBlock = extractJsonBlock(resultText);
  if (!jsonBlock) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return [];
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("facts" in parsed) ||
    !Array.isArray((parsed as { facts: unknown }).facts)
  ) {
    return [];
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
