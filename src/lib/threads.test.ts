import { describe, it, expect } from "vitest";
import { createThread, deleteThread } from "./threads";
import { getThreadSummaries, getThreadReport } from "./reports";
import { prisma } from "./db";

describe("createThread", () => {
  it("creates a bare thread with no rounds or facts, visible in summaries", async () => {
    const id = await createThread({
      companyName: "Test Co",
      position: "QA Engineer",
      location: "Remote",
    });

    const summaries = await getThreadSummaries();
    const created = summaries.find((t) => t.id === id);
    expect(created).toBeDefined();
    expect(created!.companyName).toBe("Test Co");
    expect(created!.completedRounds).toBe(0);
    expect(created!.totalRounds).toBeNull();

    const report = await getThreadReport(id);
    expect(report!.rounds).toHaveLength(0);
    expect(Object.keys(report!.sections)).toHaveLength(0);

    await deleteThread(id);
  });

  it("stores an optional company domain when provided", async () => {
    const id = await createThread({
      companyName: "Domain Co",
      companyDomain: "domainco.example",
      position: "Engineer",
      location: "Remote",
    });

    const report = await getThreadReport(id);
    expect(report!.companyDomain).toBe("domainco.example");

    await deleteThread(id);
  });
});

describe("deleteThread", () => {
  it("removes the thread and all its facts, rounds, interviewer links, profiles, messages, and section research jobs", async () => {
    const id = await createThread({
      companyName: "Delete Me Co",
      position: "Engineer",
      location: "Remote",
    });

    const round = await prisma.round.create({
      data: { threadId: id, name: "Screen", order: 1, status: "UPCOMING", confirmedSource: "test" },
    });
    const profile = await prisma.interviewerProfile.create({
      data: { threadId: id, name: "Test Interviewer" },
    });
    await prisma.roundInterviewer.create({ data: { roundId: round.id, profileId: profile.id } });
    await prisma.fact.create({
      data: { threadId: id, section: "companySnapshot", content: "test fact", sourceType: "RESEARCHED", sourceDetail: "test" },
    });
    await prisma.message.create({
      data: { threadId: id, role: "USER", text: "test message", status: "DONE" },
    });
    await prisma.sectionResearchJob.create({ data: { threadId: id, section: "compensation" } });

    await deleteThread(id);

    const report = await getThreadReport(id);
    expect(report).toBeNull();

    const remainingFacts = await prisma.fact.findMany({ where: { threadId: id } });
    const remainingRounds = await prisma.round.findMany({ where: { threadId: id } });
    const remainingProfiles = await prisma.interviewerProfile.findMany({ where: { threadId: id } });
    const remainingMessages = await prisma.message.findMany({ where: { threadId: id } });
    const remainingJobs = await prisma.sectionResearchJob.findMany({ where: { threadId: id } });
    expect(remainingFacts).toHaveLength(0);
    expect(remainingRounds).toHaveLength(0);
    expect(remainingProfiles).toHaveLength(0);
    expect(remainingMessages).toHaveLength(0);
    expect(remainingJobs).toHaveLength(0);
  });

  it("does not affect other threads", async () => {
    const before = await getThreadSummaries();
    const survivorId = before[0].id;

    const doomed = await createThread({
      companyName: "Doomed Co",
      position: "Engineer",
      location: "Remote",
    });
    await deleteThread(doomed);

    const after = await getThreadSummaries();
    expect(after.find((t) => t.id === survivorId)).toBeDefined();
  });
});
