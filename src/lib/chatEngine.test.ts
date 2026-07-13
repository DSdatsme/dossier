import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeCodeCliChatEngine } from "./chatEngine";
import { createThread, deleteThread } from "./threads";
import { prisma } from "./db";

function fakeEnvelope(resultText: string): string {
  return JSON.stringify({ result: resultText, session_id: "test", total_cost_usd: 0 });
}

function chatReply(reply: string, operations: unknown[] = []): string {
  return fakeEnvelope(JSON.stringify({ reply, operations }));
}

/** Seeds a thread with one "you" message (DONE) and one placeholder assistant
 * message (PENDING), matching what `sendChatMessageAction` creates before
 * firing `chatEngine.respond`. Returns the ids `respond` needs. */
async function seedTurn(threadId: string, userText: string) {
  await prisma.message.create({ data: { threadId, role: "USER", text: userText, status: "DONE" } });
  const assistantMessage = await prisma.message.create({
    data: { threadId, role: "ASSISTANT", text: "", status: "PENDING" },
  });
  return assistantMessage.id;
}

describe("ClaudeCodeCliChatEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies a thread-scoped addFact operation and marks the message DONE with the reply", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Comp Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Recruiter quoted $180k-$210k.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Noted the comp range.", [
        { op: "addFact", scope: "thread", section: "compensation", content: "Role: ~$180k-$210k", sourceDetail: "you" },
      ])
    );

    await engine.respond(threadId, assistantMessageId);

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ section: "compensation", content: "Role: ~$180k-$210k", sourceType: "USER_PROVIDED", state: "ACTIVE" });

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("DONE");
    expect(message.text).toBe("Noted the comp range.");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`responding for thread ${threadId}`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("applied 1 operation(s), marked DONE"));

    await deleteThread(threadId);
  });

  it("creates a round and links a newly created interviewer to it in the same turn", async () => {
    const threadId = await createThread({ companyName: "Onsite Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Next round is an onsite, interviewer is Jane Doe, senior engineer.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Got it — logged the Onsite round and added Jane Doe.", [
        { op: "createRound", name: "Onsite", status: "UPCOMING", sourceDetail: "you" },
        { op: "addInterviewer", name: "Jane Doe", role: "Senior Engineer", roundRef: "Onsite", sourceDetail: "you" },
      ])
    );

    await engine.respond(threadId, assistantMessageId);

    const rounds = await prisma.round.findMany({ where: { threadId } });
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ name: "Onsite", status: "UPCOMING", order: 1 });

    const profiles = await prisma.interviewerProfile.findMany({ where: { threadId } });
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ name: "Jane Doe", role: "Senior Engineer" });

    const links = await prisma.roundInterviewer.findMany({ where: { roundId: rounds[0].id } });
    expect(links).toHaveLength(1);
    expect(links[0].profileId).toBe(profiles[0].id);

    await deleteThread(threadId);
  });

  it("appends a new round after existing rounds by order", async () => {
    const threadId = await createThread({ companyName: "Ordered Co", position: "Engineer", location: "Remote" });
    await prisma.round.create({ data: { threadId, name: "Phone Screen", order: 1, status: "COMPLETED", confirmedSource: "you" } });
    const assistantMessageId = await seedTurn(threadId, "Next round is Onsite.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Added Onsite.", [{ op: "createRound", name: "Onsite", status: "UPCOMING", sourceDetail: "you" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const rounds = await prisma.round.findMany({ where: { threadId }, orderBy: { order: "asc" } });
    expect(rounds.map((r) => ({ name: r.name, order: r.order }))).toEqual([
      { name: "Phone Screen", order: 1 },
      { name: "Onsite", order: 2 },
    ]);

    await deleteThread(threadId);
  });

  it("updates an existing round's status by name, case-insensitively", async () => {
    const threadId = await createThread({ companyName: "Status Co", position: "Engineer", location: "Remote" });
    const round = await prisma.round.create({ data: { threadId, name: "Phone Screen", order: 1, status: "UPCOMING", confirmedSource: "you" } });
    const assistantMessageId = await seedTurn(threadId, "Did the phone screen, went fine.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Marked Phone Screen as completed.", [{ op: "updateRoundStatus", roundRef: "phone screen", status: "COMPLETED" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const updated = await prisma.round.findUniqueOrThrow({ where: { id: round.id } });
    expect(updated.status).toBe("COMPLETED");

    await deleteThread(threadId);
  });

  it("corrects an existing fact: marks the old one EDITED and inserts a new ACTIVE one", async () => {
    const threadId = await createThread({ companyName: "Correction Co", position: "Engineer", location: "Remote" });
    const original = await prisma.fact.create({
      data: { threadId, section: "compensation", content: "Role: ~$150k-$170k", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
    });
    const assistantMessageId = await seedTurn(threadId, "Actually the recruiter said $180k-$210k, not $150-170k.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Updated the comp range.", [{ op: "correctFact", factId: original.id, content: "Role: ~$180k-$210k", sourceDetail: "you" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const oldFact = await prisma.fact.findUniqueOrThrow({ where: { id: original.id } });
    expect(oldFact.state).toBe("EDITED");

    const activeFacts = await prisma.fact.findMany({ where: { threadId, state: "ACTIVE" } });
    expect(activeFacts).toHaveLength(1);
    expect(activeFacts[0]).toMatchObject({ section: "compensation", content: "Role: ~$180k-$210k", sourceType: "USER_PROVIDED" });

    await deleteThread(threadId);
  });

  it("sets confirmedTotalRounds and its source", async () => {
    const threadId = await createThread({ companyName: "Total Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Recruiter said there are 4 rounds total.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Got it, 4 rounds total.", [{ op: "setConfirmedTotalRounds", count: 4, sourceDetail: "recruiter email" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const thread = await prisma.thread.findUniqueOrThrow({ where: { id: threadId } });
    expect(thread.confirmedTotalRounds).toBe(4);
    expect(thread.confirmedTotalRoundsSource).toBe("recruiter email");

    await deleteThread(threadId);
  });

  it("adds a round-scoped fact to an existing round", async () => {
    const threadId = await createThread({ companyName: "Round Fact Co", position: "Engineer", location: "Remote" });
    await prisma.round.create({ data: { threadId, name: "Phone Screen", order: 1, status: "COMPLETED", confirmedSource: "you" } });
    const assistantMessageId = await seedTurn(threadId, "Phone screen was a 2-person panel.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Noted.", [{ op: "addFact", scope: "round", roundRef: "Phone Screen", section: "yourNotes", content: "2-person panel.", sourceDetail: "you" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const facts = await prisma.fact.findMany({ where: { threadId, roundId: { not: null } } });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ section: "yourNotes", content: "2-person panel." });

    await deleteThread(threadId);
  });

  it("rejects the whole turn and marks FAILED when an operation references an unknown round, with no partial writes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Rollback Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "System design went well, and comp is $180k.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Noted both.", [
        { op: "addFact", scope: "thread", section: "compensation", content: "Role: ~$180k", sourceDetail: "you" },
        { op: "updateRoundStatus", roundRef: "System Design", status: "COMPLETED" },
      ])
    );

    await engine.respond(threadId, assistantMessageId);

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts).toHaveLength(0);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("FAILED");
    expect(message.text).toContain("couldn't process");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`message ${assistantMessageId} FAILED`));

    await deleteThread(threadId);
  });

  it("marks FAILED when correctFact references a factId that doesn't exist", async () => {
    const threadId = await createThread({ companyName: "Missing Fact Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Actually that's wrong.");
    const engine = new ClaudeCodeCliChatEngine(async () =>
      chatReply("Fixed.", [{ op: "correctFact", factId: "does-not-exist", content: "x", sourceDetail: "you" }])
    );

    await engine.respond(threadId, assistantMessageId);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("FAILED");

    await deleteThread(threadId);
  });

  it("marks FAILED when the runner rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Crash Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "hello");
    const engine = new ClaudeCodeCliChatEngine(async () => {
      throw new Error("boom");
    });

    await engine.respond(threadId, assistantMessageId);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("FAILED");
    expect(message.text).toContain("boom");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`message ${assistantMessageId} FAILED: boom`));

    await deleteThread(threadId);
  });

  it("marks FAILED when the CLI envelope has no result field", async () => {
    const threadId = await createThread({ companyName: "No Result Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "hello");
    const engine = new ClaudeCodeCliChatEngine(async () => JSON.stringify({ session_id: "test" }));

    await engine.respond(threadId, assistantMessageId);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("FAILED");
    expect(message.text).toContain("no result text");

    await deleteThread(threadId);
  });

  it("marks FAILED when the reply text can't be understood as a chat response", async () => {
    const threadId = await createThread({ companyName: "Garbled Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "hello");
    const engine = new ClaudeCodeCliChatEngine(async () => fakeEnvelope("not json at all"));

    await engine.respond(threadId, assistantMessageId);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("FAILED");
    expect(message.text).toContain("could not be understood");

    await deleteThread(threadId);
  });

  it("never throws — even if the thread is deleted out from under it mid-response", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Vanishing Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "hello");
    const engine = new ClaudeCodeCliChatEngine(async () => {
      await deleteThread(threadId);
      return chatReply("too late", []);
    });

    await expect(engine.respond(threadId, assistantMessageId)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("thread likely gone"));
  });
});
