import type { ThreadReport, ChatMessage } from "./types";
import { VALID_SECTIONS } from "./researchParsing";
import { SECTION_TO_BUILDER } from "./researchPrompts";

export interface ChatPromptInput {
  report: ThreadReport;
  history: ChatMessage[];
  newMessage: string;
}

const THREAD_SECTIONS = Array.from(VALID_SECTIONS).join(", ");
const RESEARCHABLE_SECTIONS = Object.keys(SECTION_TO_BUILDER).join(", ");
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
    researchingSections: report.researchingSections,
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
- {"op":"researchSection","section":"<one of: ${RESEARCHABLE_SECTIONS}>","focusNote":"<a specific angle from the user's message, or an empty string if they didn't give one>"} — propose this when the user asks you to look deeper into, re-check, or dig into a specific topic about the company or role itself (not a round-tracking request). This does not do the research yourself right now — it kicks off a dedicated background research pass that updates this section once it's done.

Rules:
- Only reference a factId that actually appears in the current state above — never invent one.
- Only use "correctFact" when the user is correcting something already in the current state, not when adding something new.
- New rounds are always appended after the existing ones — you don't choose their position.
- If the message is ambiguous or you're missing information you need (e.g. which round an interviewer belongs to), return "operations": [] and ask in "reply" instead of guessing.
- If what the user describes conflicts with the round structure already in the current state (e.g. they refer to a round number or name that doesn't line up with what's tracked, or describe a process that doesn't match the existing rounds), treat this as needing clarification, not as something to force into an existing round by guessing which one they must have meant. Ask which round they mean instead of picking one.
- Do not both guess and hedge: if you are not confident enough to state something as fact, do not apply an operation for it "just in case" while also asking about it in "reply" — either you are confident enough to apply it, or you are not and it belongs only in "reply" with no matching operation.
- Never fabricate facts. Only "addInterviewer" and "researchSection" may use WebSearch/WebFetch (researchSection only via the background pass it kicks off, not in this response) to verify or find information; everything else comes from what the user told you.
- If a section is already listed in "researchingSections" in the current state above, don't propose another "researchSection" for it — tell the user in "reply" that it's already being looked into instead.

Examples:
- User says "recruiter said the range is 150-170k" → {"reply": "Noted the recruiter-quoted range.", "operations": [{"op":"addFact","scope":"thread","section":"compensation","content":"Recruiter-quoted range: ~$150k-$170k","sourceDetail":"recruiter"}]}
- User says "done with the technical round, it went well" (an "Technical Round" round already exists in the current state, status UPCOMING) → {"reply": "Marked the Technical Round as completed.", "operations": [{"op":"updateRoundStatus","roundRef":"Technical Round","status":"COMPLETED"}]}
- User says "round 6 is with Jon" but the current state's round 6 is already COMPLETED with a different interviewer, and there is no indication round 6 is being corrected or that a new round is being added → {"reply": "Round 6 is already tracked as completed with a different interviewer — is this a new round I should add, or did you mean a different round number?", "operations": []}. Do NOT guess that Jon belongs to some other existing round just because a name has to go somewhere.
- User says "can you look harder at the DevRel-specific compensation, the general range isn't useful" → {"reply": "On it — digging into DevRel-specific compensation now, I'll update this section once I've got something.", "operations": [{"op":"researchSection","section":"compensation","focusNote":"Focus specifically on Developer Relations Engineer compensation, not general SWE ranges."}]}`;
}

export interface ChatVerifyPromptInput {
  report: ThreadReport;
  newMessage: string;
  operations: unknown[];
}

export function buildChatVerifyPrompt(input: ChatVerifyPromptInput): string {
  return `You are double-checking a set of proposed updates before they get saved, to catch cases where a previous step guessed instead of asking.

Current state (JSON):
${serializeState(input.report)}

The user's message:
"${input.newMessage}"

Proposed operations (JSON), produced by a previous step from that message:
${JSON.stringify(input.operations)}

For each proposed operation, ask: is this directly and unambiguously supported by the user's message, or does it require guessing at something the user did not actually say (e.g. which round a name belongs to, whether two things refer to the same round, an inferred date or status)? A previous run of this same task got this wrong: it linked a newly-mentioned interviewer to an existing round by guessing, while its reply also asked whether the guess was right — do not repeat that mistake. If you are not fully confident an operation is directly supported, drop it rather than keeping it "just in case."

Never add a new operation that was not in the proposed list, and never edit one — your only job is to decide which of the proposed operations to keep.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"confirmedOperations": [<the subset of the proposed operations, unchanged, that are directly supported>], "clarifyingNote": "<a short question to ask the user about anything you dropped, or an empty string if nothing was dropped>"}`;
}
