import { extractJsonBlocks, VALID_SECTIONS as VALID_THREAD_SECTIONS } from "./researchParsing";

export const VALID_ROUND_SECTIONS = new Set(["prepMaterial", "smartQuestions", "yourNotes"]);

export type RoundStatusValue = "UPCOMING" | "COMPLETED" | "NOT_HAPPENING";

export type ChatOperation =
  | { op: "addFact"; scope: "thread"; section: string; content: string; sourceDetail: string }
  | { op: "addFact"; scope: "round"; roundRef: string; section: string; content: string; sourceDetail: string }
  | { op: "correctFact"; factId: string; content: string; sourceDetail: string }
  | { op: "createRound"; name: string; status: RoundStatusValue; sourceDetail: string }
  | { op: "updateRoundStatus"; roundRef: string; status: RoundStatusValue }
  | {
      op: "addInterviewer";
      name: string;
      role: string | null;
      tenure: string | null;
      background: string | null;
      roundRef: string | null;
      sourceDetail: string;
    }
  | { op: "setConfirmedTotalRounds"; count: number; sourceDetail: string };

export interface ParsedChatResponse {
  reply: string;
  operations: ChatOperation[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isRoundStatus(value: unknown): value is RoundStatusValue {
  return value === "UPCOMING" || value === "COMPLETED" || value === "NOT_HAPPENING";
}

function validateOperation(raw: unknown): ChatOperation | null {
  if (typeof raw !== "object" || raw === null || !("op" in raw)) return null;
  const record = raw as Record<string, unknown>;

  switch (record.op) {
    case "addFact": {
      if (record.scope === "thread") {
        if (
          isNonEmptyString(record.section) &&
          VALID_THREAD_SECTIONS.has(record.section) &&
          isNonEmptyString(record.content) &&
          isNonEmptyString(record.sourceDetail)
        ) {
          return { op: "addFact", scope: "thread", section: record.section, content: record.content, sourceDetail: record.sourceDetail };
        }
        return null;
      }
      if (record.scope === "round") {
        if (
          isNonEmptyString(record.roundRef) &&
          isNonEmptyString(record.section) &&
          VALID_ROUND_SECTIONS.has(record.section) &&
          isNonEmptyString(record.content) &&
          isNonEmptyString(record.sourceDetail)
        ) {
          return {
            op: "addFact",
            scope: "round",
            roundRef: record.roundRef,
            section: record.section,
            content: record.content,
            sourceDetail: record.sourceDetail,
          };
        }
        return null;
      }
      return null;
    }
    case "correctFact": {
      if (isNonEmptyString(record.factId) && isNonEmptyString(record.content) && isNonEmptyString(record.sourceDetail)) {
        return { op: "correctFact", factId: record.factId, content: record.content, sourceDetail: record.sourceDetail };
      }
      return null;
    }
    case "createRound": {
      if (isNonEmptyString(record.name) && isRoundStatus(record.status) && isNonEmptyString(record.sourceDetail)) {
        return { op: "createRound", name: record.name, status: record.status, sourceDetail: record.sourceDetail };
      }
      return null;
    }
    case "updateRoundStatus": {
      if (isNonEmptyString(record.roundRef) && isRoundStatus(record.status)) {
        return { op: "updateRoundStatus", roundRef: record.roundRef, status: record.status };
      }
      return null;
    }
    case "addInterviewer": {
      if (isNonEmptyString(record.name) && isNonEmptyString(record.sourceDetail)) {
        return {
          op: "addInterviewer",
          name: record.name,
          role: optionalString(record.role),
          tenure: optionalString(record.tenure),
          background: optionalString(record.background),
          roundRef: optionalString(record.roundRef),
          sourceDetail: record.sourceDetail,
        };
      }
      return null;
    }
    case "setConfirmedTotalRounds": {
      if (typeof record.count === "number" && Number.isInteger(record.count) && record.count > 0 && isNonEmptyString(record.sourceDetail)) {
        return { op: "setConfirmedTotalRounds", count: record.count, sourceDetail: record.sourceDetail };
      }
      return null;
    }
    default:
      return null;
  }
}

function tryParseCandidate(jsonBlock: string): ParsedChatResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || !("reply" in parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!isNonEmptyString(record.reply)) return null;

  if (record.operations === undefined) {
    return { reply: record.reply, operations: [] };
  }
  if (!Array.isArray(record.operations)) return null;

  const operations: ChatOperation[] = [];
  for (const rawOperation of record.operations) {
    const validated = validateOperation(rawOperation);
    if (validated === null) return null;
    operations.push(validated);
  }

  return { reply: record.reply, operations };
}

export function parseChatResponse(resultText: string): ParsedChatResponse | null {
  const candidates = extractJsonBlocks(resultText);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const result = tryParseCandidate(candidates[i]);
    if (result !== null) return result;
  }
  return null;
}
