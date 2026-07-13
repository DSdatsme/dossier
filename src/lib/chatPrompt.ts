import type { ThreadReport, ChatMessage } from "./types";

export interface ChatPromptInput {
  report: ThreadReport;
  history: ChatMessage[];
  newMessage: string;
}

const THREAD_SECTIONS =
  "companySnapshot, fundingNews, companyAtLocation, cultureValues, roleSpecifics, techStack, compensation, redFlags, sources";
const ROUND_SECTIONS = "prepMaterial, smartQuestions, yourNotes";
const ROUND_STATUSES = "UPCOMING, COMPLETED, NOT_HAPPENING";

function serializeState(report: ThreadReport): string {
  const threadFacts = Object.entries(report.sections).flatMap(([section, facts]) =>
    facts.map((fact) => ({ id: fact.id, section, content: fact.content }))
  );

  const rounds = report.rounds.map((round) => ({
    id: round.id,
    name: round.name,
    order: round.order,
    status: round.status,
    interviewers: round.interviewers.map((interviewer) => ({
      id: interviewer.id,
      name: interviewer.name,
      role: interviewer.role,
      tenure: interviewer.tenure,
      background: interviewer.background,
    })),
    prepMaterial: round.prepMaterial.map((fact) => ({ id: fact.id, content: fact.content })),
    smartQuestions: round.smartQuestions.map((fact) => ({ id: fact.id, content: fact.content })),
    yourNotes: round.yourNotes.map((fact) => ({ id: fact.id, content: fact.content })),
  }));

  return JSON.stringify({
    confirmedTotalRounds: report.confirmedTotalRounds,
    confirmedTotalRoundsSource: report.confirmedTotalRoundsSource,
    threadFacts,
    rounds,
  });
}

function serializeHistory(history: ChatMessage[]): string {
  if (history.length === 0) return "(no earlier messages)";
  return history.map((message) => `${message.from === "you" ? "You" : "Assistant"}: ${message.text}`).join("\n");
}

export function buildChatPrompt(input: ChatPromptInput): string {
  return `You are helping track a company's interview pipeline for "${input.report.companyName}" — "${input.report.position}" position in ${input.report.location}.

Current state (JSON):
${serializeState(input.report)}

Recent conversation:
${serializeHistory(input.history)}

New message from the user:
"${input.newMessage}"

Decide what changed and respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"reply": "<short confirmation or clarifying question>", "operations": [<zero or more operation objects>]}

Valid operation shapes:
- {"op":"addFact","scope":"thread","section":"<one of: ${THREAD_SECTIONS}>","content":"...","sourceDetail":"..."}
- {"op":"addFact","scope":"round","roundRef":"<an existing round's id or name, or the name of a round you create earlier in this same operations list>","section":"<one of: ${ROUND_SECTIONS}>","content":"...","sourceDetail":"..."}
- {"op":"correctFact","factId":"<id from threadFacts or a round's fact list in the current state above>","content":"...","sourceDetail":"..."}
- {"op":"createRound","name":"...","status":"<one of: ${ROUND_STATUSES}>","sourceDetail":"..."}
- {"op":"updateRoundStatus","roundRef":"...","status":"<one of: ${ROUND_STATUSES}>"}
- {"op":"addInterviewer","name":"...","role":"...","tenure":"...","background":"...","roundRef":"...","sourceDetail":"..."} — use WebSearch/WebFetch to verify or fill in role/tenure/background when you can find the person; omit fields you can't find
- {"op":"setConfirmedTotalRounds","count":<number>,"sourceDetail":"..."}

Rules:
- Only reference a factId that actually appears in the current state above — never invent one.
- Only use "correctFact" when the user is correcting something already in the current state, not when adding something new.
- New rounds are always appended after the existing ones — you don't choose their position.
- If the message is ambiguous or you're missing information you need (e.g. which round an interviewer belongs to), return "operations": [] and ask in "reply" instead of guessing.
- Never fabricate facts. Only "addInterviewer" may use WebSearch/WebFetch to verify a named person; everything else comes from what the user told you.`;
}
