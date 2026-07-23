import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeCodeCliChatEngine, enrichInterviewer, researchSectionInBackground } from "./chatEngine";
import { createThread, deleteThread } from "./threads";
import { prisma } from "./db";

function fakeEnvelope(resultText: string): string {
  return JSON.stringify({ result: resultText, session_id: "test", total_cost_usd: 0 });
}

function chatReply(reply: string, operations: unknown[] = []): string {
  return fakeEnvelope(JSON.stringify({ reply, operations }));
}

function researchEnvelope(facts: unknown[]): string {
  return fakeEnvelope(JSON.stringify({ facts }));
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
    // Second arg is the deep-research runner used for the async interviewer-enrichment
    // sub-task this turn now triggers — a harmless no-op fake, so no real CLI spawns.
    const engine = new ClaudeCodeCliChatEngine(
      async () =>
        chatReply("Got it — logged the Onsite round and added Jane Doe.", [
          { op: "createRound", name: "Onsite", status: "UPCOMING", sourceDetail: "you" },
          { op: "addInterviewer", name: "Jane Doe", role: "Senior Engineer", roundRef: "Onsite", sourceDetail: "you" },
        ]),
      async () => fakeEnvelope("{}")
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

  it("drops an operation the verify pass does not confirm, and appends its clarifying note to the reply", async () => {
    const threadId = await createThread({ companyName: "Verify Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Round 7 is with Jon.");
    const engine = new ClaudeCodeCliChatEngine(async (prompt) => {
      if (prompt.includes("double-checking a set of proposed updates")) {
        return fakeEnvelope(JSON.stringify({ confirmedOperations: [], clarifyingNote: "Which round is this for?" }));
      }
      return chatReply("Logged it.", [{ op: "addInterviewer", name: "Jon", roundRef: "Hiring Manager Interview", sourceDetail: "you" }]);
    });

    await engine.respond(threadId, assistantMessageId);

    const interviewers = await prisma.interviewerProfile.findMany({ where: { threadId } });
    expect(interviewers).toHaveLength(0);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("DONE");
    expect(message.text).toBe("Logged it. Which round is this for?");

    await deleteThread(threadId);
  });

  it("verify pass can confirm some operations from a turn and drop others", async () => {
    const threadId = await createThread({ companyName: "Partial Verify Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Comp is 180k, and round 7 is with Jon.");
    const engine = new ClaudeCodeCliChatEngine(async (prompt) => {
      if (prompt.includes("double-checking a set of proposed updates")) {
        return fakeEnvelope(
          JSON.stringify({
            confirmedOperations: [{ op: "addFact", scope: "thread", section: "compensation", content: "Role: ~180k", sourceDetail: "you" }],
            clarifyingNote: "Which round is Jon interviewing for?",
          })
        );
      }
      return chatReply("Noted.", [
        { op: "addFact", scope: "thread", section: "compensation", content: "Role: ~180k", sourceDetail: "you" },
        { op: "addInterviewer", name: "Jon", roundRef: "7", sourceDetail: "you" },
      ]);
    });

    await engine.respond(threadId, assistantMessageId);

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe("Role: ~180k");

    const interviewers = await prisma.interviewerProfile.findMany({ where: { threadId } });
    expect(interviewers).toHaveLength(0);

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.text).toBe("Noted. Which round is Jon interviewing for?");

    await deleteThread(threadId);
  });

  it("falls back to applying unverified operations when the verify pass itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Verify Crash Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Recruiter quoted $180k-$210k.");
    const engine = new ClaudeCodeCliChatEngine(async (prompt) => {
      if (prompt.includes("double-checking a set of proposed updates")) {
        throw new Error("verify boom");
      }
      return chatReply("Noted the comp range.", [
        { op: "addFact", scope: "thread", section: "compensation", content: "Role: ~$180k-$210k", sourceDetail: "you" },
      ]);
    });

    await engine.respond(threadId, assistantMessageId);

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts).toHaveLength(1);
    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("DONE");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("verify pass failed"));

    await deleteThread(threadId);
  });

  it("proposing researchSection creates a job row and does not error the turn", async () => {
    const threadId = await createThread({ companyName: "Trigger Co", position: "Engineer", location: "Remote" });
    const assistantMessageId = await seedTurn(threadId, "Can you look harder at DevRel comp?");
    // The deepRunner never resolves, so the fire-and-forget researchSectionInBackground
    // call (kicked off but not awaited by respond()) never reaches its finally-block
    // cleanup during this test — otherwise it can race ahead of our own assertions and
    // delete the job row before we get to check it existed.
    const engine = new ClaudeCodeCliChatEngine(
      async () =>
        chatReply("On it — digging into DevRel-specific compensation now.", [
          { op: "researchSection", section: "compensation", focusNote: "Focus on DevRel comp specifically." },
        ]),
      () => new Promise(() => {}),
      async () => fakeEnvelope("{}")
    );

    await engine.respond(threadId, assistantMessageId);

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].section).toBe("compensation");

    const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(message.status).toBe("DONE");

    await deleteThread(threadId);
  });

  it("does not create a duplicate job when a section is already being researched", async () => {
    const threadId = await createThread({ companyName: "Duplicate Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "compensation" } });
    const assistantMessageId = await seedTurn(threadId, "Can you look harder at DevRel comp again?");
    const engine = new ClaudeCodeCliChatEngine(
      async () => chatReply("Already digging into that.", [{ op: "researchSection", section: "compensation", focusNote: "" }]),
      async () => fakeEnvelope("{}"),
      async () => fakeEnvelope("{}")
    );

    await engine.respond(threadId, assistantMessageId);

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(1);

    await deleteThread(threadId);
  });

  it("does not start section research while the initial research pipeline is still running", async () => {
    const threadId = await createThread({ companyName: "Still Researching Co", position: "Engineer", location: "Remote" });
    await prisma.thread.update({ where: { id: threadId }, data: { researchStatus: "RESEARCHING" } });
    const assistantMessageId = await seedTurn(threadId, "Can you look harder at DevRel comp?");
    const engine = new ClaudeCodeCliChatEngine(
      async () => chatReply("On it.", [{ op: "researchSection", section: "compensation", focusNote: "" }]),
      async () => fakeEnvelope("{}"),
      async () => fakeEnvelope("{}")
    );

    await engine.respond(threadId, assistantMessageId);

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(0);

    await deleteThread(threadId);
  });
});

describe("enrichInterviewer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fills in role/tenure/background from deep research when they are not already known", async () => {
    const threadId = await createThread({ companyName: "Deep Co", position: "Engineer", location: "Remote" });
    const profile = await prisma.interviewerProfile.create({ data: { threadId, name: "Jane Doe", sourceDetail: "you" } });

    await enrichInterviewer(
      async () => fakeEnvelope(JSON.stringify({ role: "Staff Engineer", tenure: "5 yrs", background: "Ex-Google" })),
      threadId,
      profile.id,
      "Jane Doe",
      "Deep Co"
    );

    const updated = await prisma.interviewerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(updated.role).toBe("Staff Engineer");
    expect(updated.tenure).toBe("5 yrs");
    expect(updated.background).toBe("Ex-Google");

    await deleteThread(threadId);
  });

  it("does not overwrite fields the user already provided", async () => {
    const threadId = await createThread({ companyName: "Deep Co", position: "Engineer", location: "Remote" });
    const profile = await prisma.interviewerProfile.create({
      data: { threadId, name: "Jane Doe", role: "Senior Engineer (per you)", sourceDetail: "you" },
    });

    await enrichInterviewer(
      async () => fakeEnvelope(JSON.stringify({ role: "Staff Engineer", tenure: "5 yrs", background: "Ex-Google" })),
      threadId,
      profile.id,
      "Jane Doe",
      "Deep Co"
    );

    const updated = await prisma.interviewerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(updated.role).toBe("Senior Engineer (per you)");
    expect(updated.tenure).toBe("5 yrs");

    await deleteThread(threadId);
  });

  it("does nothing when the interviewer profile no longer exists", async () => {
    await expect(
      enrichInterviewer(async () => fakeEnvelope("{}"), "gone-thread", "gone-profile", "Jane Doe", "Deep Co")
    ).resolves.toBeUndefined();
  });

  it("does nothing when the runner rejects", async () => {
    const threadId = await createThread({ companyName: "Deep Co", position: "Engineer", location: "Remote" });
    const profile = await prisma.interviewerProfile.create({ data: { threadId, name: "Jane Doe", sourceDetail: "you" } });

    await expect(
      enrichInterviewer(
        async () => {
          throw new Error("boom");
        },
        threadId,
        profile.id,
        "Jane Doe",
        "Deep Co"
      )
    ).rejects.toThrow("boom");

    await deleteThread(threadId);
  });
});

describe("researchSectionInBackground", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes new facts and cleans up the job row on success", async () => {
    const threadId = await createThread({ companyName: "Section Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "compensation" } });

    await researchSectionInBackground(
      async () => researchEnvelope([{ section: "compensation", content: "DevRel: ~$163k-$237k", sourceDetail: "google careers" }]),
      async () => researchEnvelope([{ section: "compensation", content: "DevRel: ~$163k-$237k", sourceDetail: "google careers" }]),
      threadId,
      "compensation",
      "Focus on DevRel comp specifically.",
      { companyName: "Section Co", companyDomain: null, position: "Engineer", location: "Remote" }
    );

    const facts = await prisma.fact.findMany({ where: { threadId, section: "compensation" } });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ content: "DevRel: ~$163k-$237k", sourceType: "RESEARCHED" });

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(0);

    await deleteThread(threadId);
  });

  // Regression test: SECTION_TO_BUILDER routes a single targeted section to a
  // cluster builder that covers multiple sections (e.g. "redFlags" runs
  // buildEmployeeExperiencePrompt, which also returns "cultureValues" and every
  // cluster's "sources" facts). Each fact must be written under its own
  // fact.section, not force-labeled as the section the user targeted.
  it("writes each returned fact under its own section, not the single targeted section", async () => {
    const threadId = await createThread({ companyName: "Multi Section Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "redFlags" } });

    const clusterResponse = [
      { section: "redFlags", content: "Layoffs reported in 2026.", sourceDetail: "business news" },
      { section: "cultureValues", content: "Glassdoor: 3.8/5, 500 reviews", sourceDetail: "glassdoor.com" },
      { section: "sources", content: "glassdoor.com — ratings and reviews", sourceDetail: "Glassdoor" },
    ];

    await researchSectionInBackground(
      async () => researchEnvelope(clusterResponse),
      async () => researchEnvelope(clusterResponse),
      threadId,
      "redFlags",
      "",
      { companyName: "Multi Section Co", companyDomain: null, position: "Engineer", location: "Remote" }
    );

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts.find((f) => f.content === "Layoffs reported in 2026.")).toMatchObject({ section: "redFlags" });
    expect(facts.find((f) => f.content === "Glassdoor: 3.8/5, 500 reviews")).toMatchObject({ section: "cultureValues" });
    expect(facts.find((f) => f.content === "glassdoor.com — ratings and reviews")).toMatchObject({ section: "sources" });

    await deleteThread(threadId);
  });

  it("only writes the facts the dedup pass keeps, leaving existing facts untouched", async () => {
    const threadId = await createThread({ companyName: "Dedup Co", position: "Engineer", location: "Remote" });
    await prisma.fact.create({
      data: { threadId, section: "compensation", content: "Role: ~$150k-$170k", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
    });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "compensation" } });

    await researchSectionInBackground(
      async () =>
        researchEnvelope([
          { section: "compensation", content: "Role: ~$150k-$170k (Glassdoor)", sourceDetail: "glassdoor.com" },
          { section: "compensation", content: "DevRel: ~$163k-$237k", sourceDetail: "google careers" },
        ]),
      async () => researchEnvelope([{ section: "compensation", content: "DevRel: ~$163k-$237k", sourceDetail: "google careers" }]),
      threadId,
      "compensation",
      "",
      { companyName: "Dedup Co", companyDomain: null, position: "Engineer", location: "Remote" }
    );

    const facts = await prisma.fact.findMany({ where: { threadId, section: "compensation" } });
    expect(facts.map((f) => f.content).sort()).toEqual(["DevRel: ~$163k-$237k", "Role: ~$150k-$170k"].sort());

    await deleteThread(threadId);
  });

  it("falls back to keeping all new facts when the dedup pass itself fails", async () => {
    const threadId = await createThread({ companyName: "Dedup Crash Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "techStack" } });

    await researchSectionInBackground(
      async () => researchEnvelope([{ section: "techStack", content: "Rust", sourceDetail: "eng blog" }]),
      async () => {
        throw new Error("dedup boom");
      },
      threadId,
      "techStack",
      "",
      { companyName: "Dedup Crash Co", companyDomain: null, position: "Engineer", location: "Remote" }
    );

    const facts = await prisma.fact.findMany({ where: { threadId, section: "techStack" } });
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe("Rust");

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(0);

    await deleteThread(threadId);
  });

  it("cleans up the job row and writes nothing when the research call finds no facts", async () => {
    const threadId = await createThread({ companyName: "Empty Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "interviewProcess" } });

    await researchSectionInBackground(
      async () => researchEnvelope([]),
      async () => researchEnvelope([]),
      threadId,
      "interviewProcess",
      "",
      { companyName: "Empty Co", companyDomain: null, position: "Engineer", location: "Remote" }
    );

    const facts = await prisma.fact.findMany({ where: { threadId } });
    expect(facts).toHaveLength(0);
    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(0);

    await deleteThread(threadId);
  });

  it("cleans up the job row even when the research call rejects", async () => {
    const threadId = await createThread({ companyName: "Research Crash Co", position: "Engineer", location: "Remote" });
    await prisma.sectionResearchJob.create({ data: { threadId, section: "compensation" } });

    await expect(
      researchSectionInBackground(
        async () => {
          throw new Error("research boom");
        },
        async () => researchEnvelope([]),
        threadId,
        "compensation",
        "",
        { companyName: "Research Crash Co", companyDomain: null, position: "Engineer", location: "Remote" }
      )
    ).rejects.toThrow("research boom");

    const jobs = await prisma.sectionResearchJob.findMany({ where: { threadId } });
    expect(jobs).toHaveLength(0);

    await deleteThread(threadId);
  });
});
