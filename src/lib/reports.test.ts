import { describe, it, expect } from "vitest";
import { getThreadSummaries, getThreadReport } from "./reports";
import { deleteThread } from "./threads";
import { prisma } from "./db";

describe("getThreadSummaries", () => {
  it("returns all seeded threads with round counts", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics");

    expect(nimbus).toBeDefined();
    expect(nimbus!.completedRounds).toBe(2);
    expect(nimbus!.totalRounds).toBe(4);
    expect(nimbus!.hasNotHappeningRound).toBe(true);

    const acme = summaries.find((t) => t.companyName === "Acme Corp");
    expect(acme!.completedRounds).toBe(0);
    expect(acme!.totalRounds).toBeNull();
  });

  it("orders threads by most recent chat activity first, falling back to creation time for threads with no messages", async () => {
    const older = await prisma.thread.create({
      data: { companyName: "Older Chat Co", position: "Engineer", location: "Remote", createdAt: new Date("2020-01-01") },
    });
    const newer = await prisma.thread.create({
      data: { companyName: "Newer Chat Co", position: "Engineer", location: "Remote", createdAt: new Date("2020-01-02") },
    });
    const neverChatted = await prisma.thread.create({
      data: { companyName: "Never Chatted Co", position: "Engineer", location: "Remote", createdAt: new Date("2020-01-03") },
    });

    // Chat activity reverses the creation-time order: `older` was chatted
    // with most recently, so it should rank above `newer` despite being
    // created first. `neverChatted` has no messages, so it falls back to its
    // own (older) creation time and ranks last.
    await prisma.message.create({
      data: { threadId: newer.id, role: "USER", text: "hi", status: "DONE", createdAt: new Date("2020-02-01") },
    });
    await prisma.message.create({
      data: { threadId: older.id, role: "USER", text: "hi", status: "DONE", createdAt: new Date("2020-03-01") },
    });

    const summaries = await getThreadSummaries();
    const ids = new Set([older.id, newer.id, neverChatted.id]);
    const relativeOrder = summaries.map((t) => t.id).filter((id) => ids.has(id));

    expect(relativeOrder).toEqual([older.id, newer.id, neverChatted.id]);

    await deleteThread(older.id);
    await deleteThread(newer.id);
    await deleteThread(neverChatted.id);
  });
});

describe("getThreadReport", () => {
  it("returns null for an unknown thread id", async () => {
    const report = await getThreadReport("does-not-exist");
    expect(report).toBeNull();
  });

  it("groups shared facts by section for Nimbus Robotics, keeping source type", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics")!;
    const report = await getThreadReport(nimbus.id);

    expect(report).not.toBeNull();
    expect(report!.sections.techStack).toHaveLength(6);
    expect(report!.sections.techStack.some((f) => f.sourceType === "USER_PROVIDED")).toBe(true);
  });

  it("orders rounds by `order` and attaches interviewer links", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics")!;
    const report = await getThreadReport(nimbus.id);

    expect(report!.rounds.map((r) => r.name)).toEqual([
      "HR Screening",
      "Technical",
      "System Design",
      "Hiring Manager",
    ]);
    expect(report!.rounds[1].interviewers[0].name).toBe("Morgan Patel");
    expect(report!.rounds[2].status).toBe("NOT_HAPPENING");
    expect(report!.rounds[2].yourNotes[0].content).toContain("skipping System Design");
  });

  it("exposes research status, defaulting to DONE for threads not created through the research trigger", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics")!;
    const report = await getThreadReport(nimbus.id);

    expect(report!.researchStatus).toBe("DONE");
    expect(report!.researchError).toBeNull();
  });

  it("excludes a thread-level fact that has been corrected (state EDITED)", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics")!;
    const before = await getThreadReport(nimbus.id);
    const targetFact = before!.sections.techStack[0];

    await prisma.fact.update({ where: { id: targetFact.id }, data: { state: "EDITED" } });

    const after = await getThreadReport(nimbus.id);
    expect(after!.sections.techStack.some((f) => f.id === targetFact.id)).toBe(false);

    await prisma.fact.update({ where: { id: targetFact.id }, data: { state: "ACTIVE" } });
  });

  it("excludes a round-level fact that has been corrected (state EDITED)", async () => {
    const summaries = await getThreadSummaries();
    const nimbus = summaries.find((t) => t.companyName === "Nimbus Robotics")!;
    const before = await getThreadReport(nimbus.id);
    const targetFact = before!.rounds[0].prepMaterial[0];

    await prisma.fact.update({ where: { id: targetFact.id }, data: { state: "EDITED" } });

    const after = await getThreadReport(nimbus.id);
    expect(after!.rounds[0].prepMaterial.some((f) => f.id === targetFact.id)).toBe(false);

    await prisma.fact.update({ where: { id: targetFact.id }, data: { state: "ACTIVE" } });
  });
});
