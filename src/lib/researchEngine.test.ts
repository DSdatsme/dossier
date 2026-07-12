import { describe, it, expect } from "vitest";
import { ClaudeCodeCliResearchEngine } from "./researchEngine";
import { createThread, deleteThread } from "./threads";
import { getThreadReport } from "./reports";

function fakeEnvelope(resultText: string): string {
  return JSON.stringify({ result: resultText, session_id: "test", total_cost_usd: 0 });
}

describe("ClaudeCodeCliResearchEngine", () => {
  it("writes valid facts and marks the thread DONE", async () => {
    const threadId = await createThread({ companyName: "Test Research Co", position: "Engineer", location: "Remote" });
    const resultText = JSON.stringify({
      facts: [
        { section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" },
        { section: "techStack", content: "Go", sourceDetail: "stackshare.io" },
      ],
    });
    const engine = new ClaudeCodeCliResearchEngine(async () => fakeEnvelope(resultText));

    await engine.research({
      threadId,
      companyName: "Test Research Co",
      companyDomain: null,
      position: "Engineer",
      location: "Remote",
    });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("DONE");
    expect(report!.researchError).toBeNull();
    expect(report!.sections.companySnapshot).toHaveLength(1);
    expect(report!.sections.companySnapshot[0].content).toBe("Founded: 2020");
    expect(report!.sections.companySnapshot[0].sourceType).toBe("RESEARCHED");
    expect(report!.sections.techStack[0].content).toBe("Go");

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when no facts can be extracted", async () => {
    const threadId = await createThread({ companyName: "Empty Result Co", position: "Engineer", location: "Remote" });
    const engine = new ClaudeCodeCliResearchEngine(async () => fakeEnvelope("no useful json here"));

    await engine.research({
      threadId,
      companyName: "Empty Result Co",
      companyDomain: null,
      position: "Engineer",
      location: "Remote",
    });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toContain("No facts");

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when the runner rejects", async () => {
    const threadId = await createThread({ companyName: "Crash Co", position: "Engineer", location: "Remote" });
    const engine = new ClaudeCodeCliResearchEngine(async () => {
      throw new Error("boom");
    });

    await engine.research({
      threadId,
      companyName: "Crash Co",
      companyDomain: null,
      position: "Engineer",
      location: "Remote",
    });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toBe("boom");

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when the CLI envelope has no result field", async () => {
    const threadId = await createThread({ companyName: "No Result Co", position: "Engineer", location: "Remote" });
    const engine = new ClaudeCodeCliResearchEngine(async () => JSON.stringify({ session_id: "test" }));

    await engine.research({
      threadId,
      companyName: "No Result Co",
      companyDomain: null,
      position: "Engineer",
      location: "Remote",
    });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toContain("no result text");

    await deleteThread(threadId);
  });

  it("never throws — even if the thread is deleted out from under it mid-research", async () => {
    const threadId = await createThread({ companyName: "Vanishing Co", position: "Engineer", location: "Remote" });
    const resultText = JSON.stringify({
      facts: [{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }],
    });
    const engine = new ClaudeCodeCliResearchEngine(async () => {
      await deleteThread(threadId);
      return fakeEnvelope(resultText);
    });

    await expect(
      engine.research({
        threadId,
        companyName: "Vanishing Co",
        companyDomain: null,
        position: "Engineer",
        location: "Remote",
      })
    ).resolves.toBeUndefined();
  });
});
