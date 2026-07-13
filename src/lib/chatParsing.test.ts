import { describe, it, expect } from "vitest";
import { parseChatResponse } from "./chatParsing";

describe("parseChatResponse", () => {
  it("parses a reply with no operations", () => {
    const text = JSON.stringify({ reply: "Got it.", operations: [] });
    expect(parseChatResponse(text)).toEqual({ reply: "Got it.", operations: [] });
  });

  it("defaults operations to an empty array when the key is omitted", () => {
    const text = JSON.stringify({ reply: "Got it." });
    expect(parseChatResponse(text)).toEqual({ reply: "Got it.", operations: [] });
  });

  it("parses a valid addFact operation scoped to the thread", () => {
    const text = JSON.stringify({
      reply: "Noted the comp range.",
      operations: [{ op: "addFact", scope: "thread", section: "compensation", content: "Role: ~$180k-$210k", sourceDetail: "you" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Noted the comp range.",
      operations: [{ op: "addFact", scope: "thread", section: "compensation", content: "Role: ~$180k-$210k", sourceDetail: "you" }],
    });
  });

  it("parses a valid addFact operation scoped to a round", () => {
    const text = JSON.stringify({
      reply: "Noted.",
      operations: [{ op: "addFact", scope: "round", roundRef: "Phone Screen", section: "yourNotes", content: "Went well.", sourceDetail: "you" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Noted.",
      operations: [{ op: "addFact", scope: "round", roundRef: "Phone Screen", section: "yourNotes", content: "Went well.", sourceDetail: "you" }],
    });
  });

  it("parses a valid correctFact operation", () => {
    const text = JSON.stringify({
      reply: "Fixed it.",
      operations: [{ op: "correctFact", factId: "fct-1", content: "4 rounds total", sourceDetail: "you" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Fixed it.",
      operations: [{ op: "correctFact", factId: "fct-1", content: "4 rounds total", sourceDetail: "you" }],
    });
  });

  it("parses a valid createRound operation", () => {
    const text = JSON.stringify({
      reply: "Added the onsite.",
      operations: [{ op: "createRound", name: "Onsite", status: "UPCOMING", sourceDetail: "you" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Added the onsite.",
      operations: [{ op: "createRound", name: "Onsite", status: "UPCOMING", sourceDetail: "you" }],
    });
  });

  it("parses a valid updateRoundStatus operation", () => {
    const text = JSON.stringify({
      reply: "Marked it completed.",
      operations: [{ op: "updateRoundStatus", roundRef: "Phone Screen", status: "COMPLETED" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Marked it completed.",
      operations: [{ op: "updateRoundStatus", roundRef: "Phone Screen", status: "COMPLETED" }],
    });
  });

  it("parses a valid addInterviewer operation, defaulting missing optional fields to null", () => {
    const text = JSON.stringify({
      reply: "Added Jane.",
      operations: [{ op: "addInterviewer", name: "Jane Doe", roundRef: "Onsite", sourceDetail: "you" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Added Jane.",
      operations: [{ op: "addInterviewer", name: "Jane Doe", role: null, tenure: null, background: null, roundRef: "Onsite", sourceDetail: "you" }],
    });
  });

  it("parses a valid setConfirmedTotalRounds operation", () => {
    const text = JSON.stringify({
      reply: "Got it, 4 rounds.",
      operations: [{ op: "setConfirmedTotalRounds", count: 4, sourceDetail: "recruiter email" }],
    });

    expect(parseChatResponse(text)).toEqual({
      reply: "Got it, 4 rounds.",
      operations: [{ op: "setConfirmedTotalRounds", count: 4, sourceDetail: "recruiter email" }],
    });
  });

  it("extracts JSON wrapped in a fenced code block", () => {
    const text = 'Here:\n```json\n{"reply": "ok", "operations": []}\n```\nDone.';
    expect(parseChatResponse(text)).toEqual({ reply: "ok", operations: [] });
  });

  it("returns null for malformed JSON", () => {
    expect(parseChatResponse("this is not json at all")).toBeNull();
  });

  it("returns null when reply is missing or not a string", () => {
    expect(parseChatResponse(JSON.stringify({ operations: [] }))).toBeNull();
    expect(parseChatResponse(JSON.stringify({ reply: 123, operations: [] }))).toBeNull();
  });

  it("returns null when operations is present but not an array", () => {
    expect(parseChatResponse(JSON.stringify({ reply: "ok", operations: "not an array" }))).toBeNull();
  });

  it("rejects the whole response when any single operation has an invalid section", () => {
    const text = JSON.stringify({
      reply: "ok",
      operations: [
        { op: "addFact", scope: "thread", section: "notARealSection", content: "x", sourceDetail: "you" },
      ],
    });
    expect(parseChatResponse(text)).toBeNull();
  });

  it("rejects the whole response when one operation among several valid ones is invalid", () => {
    const text = JSON.stringify({
      reply: "ok",
      operations: [
        { op: "addFact", scope: "thread", section: "compensation", content: "x", sourceDetail: "you" },
        { op: "updateRoundStatus", roundRef: "Onsite", status: "NOT_A_REAL_STATUS" },
      ],
    });
    expect(parseChatResponse(text)).toBeNull();
  });

  it("rejects an operation with an unknown op name", () => {
    const text = JSON.stringify({ reply: "ok", operations: [{ op: "deleteEverything" }] });
    expect(parseChatResponse(text)).toBeNull();
  });

  it("rejects setConfirmedTotalRounds with a non-positive or non-integer count", () => {
    expect(
      parseChatResponse(JSON.stringify({ reply: "ok", operations: [{ op: "setConfirmedTotalRounds", count: 0, sourceDetail: "you" }] }))
    ).toBeNull();
    expect(
      parseChatResponse(JSON.stringify({ reply: "ok", operations: [{ op: "setConfirmedTotalRounds", count: 2.5, sourceDetail: "you" }] }))
    ).toBeNull();
  });

  it("prefers the last fenced JSON block over an earlier placeholder/example block", () => {
    const text = `Example:
\`\`\`json
{"reply": "EXAMPLE", "operations": []}
\`\`\`

Actual:
\`\`\`json
{"reply": "real reply", "operations": []}
\`\`\``;
    expect(parseChatResponse(text)).toEqual({ reply: "real reply", operations: [] });
  });
});
