import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeCodeCliResearchEngine } from "./researchEngine";
import { createThread, deleteThread } from "./threads";
import { getThreadReport } from "./reports";

function fakeEnvelope(resultText: string): string {
  return JSON.stringify({ result: resultText, session_id: "test", total_cost_usd: 0 });
}

function factsEnvelope(facts: unknown[]): string {
  return fakeEnvelope(JSON.stringify({ facts }));
}

function factsEnvelopeWithUsage(facts: unknown[], usage: { costUsd: number; numTurns: number }): string {
  return JSON.stringify({
    result: JSON.stringify({ facts }),
    session_id: "test",
    total_cost_usd: usage.costUsd,
    num_turns: usage.numTurns,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
    },
  });
}

const input = {
  threadId: "placeholder",
  companyName: "Test Research Co",
  companyDomain: null,
  position: "Engineer",
  location: "Remote",
};

describe("ClaudeCodeCliResearchEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs 5 cluster calls in parallel, merges, verifies, and writes the surviving facts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Test Research Co", position: "Engineer", location: "Remote" });

    const runner = async (prompt: string) => {
      if (prompt.includes("companySnapshot, fundingNews")) {
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com", sourceUrl: "https://example.com" }]);
      }
      if (prompt.includes("roleSpecifics, techStack, companyAtLocation")) {
        return factsEnvelope([{ section: "techStack", content: "Go", sourceDetail: "stackshare.io" }]);
      }
      if (prompt.includes("fact-checking a list of researched facts")) {
        // Verify pass: drop the techStack fact, keep companySnapshot.
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }]);
      }
      return factsEnvelope([]);
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("DONE");
    expect(report!.researchError).toBeNull();
    expect(report!.sections.companySnapshot).toHaveLength(1);
    expect(report!.sections.companySnapshot[0].content).toBe("Founded: 2020");
    expect(report!.sections.companySnapshot[0].sourceType).toBe("RESEARCHED");
    expect(report!.sections.techStack).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`starting for thread ${threadId}`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("wrote 1 facts, marked DONE"));

    await deleteThread(threadId);
  });

  it("keeps unverified merged facts when the verification call itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Verify Crash Co", position: "Engineer", location: "Remote" });

    const runner = async (prompt: string) => {
      if (prompt.includes("fact-checking a list of researched facts")) {
        throw new Error("verify boom");
      }
      if (prompt.includes("companySnapshot, fundingNews")) {
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }]);
      }
      return factsEnvelope([]);
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("DONE");
    expect(report!.sections.companySnapshot).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("verification pass failed, keeping unverified facts"));

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when no facts survive verification", async () => {
    const threadId = await createThread({ companyName: "Nothing Survives Co", position: "Engineer", location: "Remote" });

    const runner = async (prompt: string) => {
      if (prompt.includes("fact-checking a list of researched facts")) {
        return factsEnvelope([]);
      }
      if (prompt.includes("companySnapshot, fundingNews")) {
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }]);
      }
      return factsEnvelope([]);
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toBe("No facts survived verification.");

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when no facts can be extracted from any cluster", async () => {
    const threadId = await createThread({ companyName: "Empty Result Co", position: "Engineer", location: "Remote" });
    const runner = async () => fakeEnvelope("no useful json here");
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toContain("No facts");

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when every cluster call rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Crash Co", position: "Engineer", location: "Remote" });
    const runner = async () => {
      throw new Error("boom");
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toBe("No facts could be extracted from the research run.");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("failed: boom"));

    await deleteThread(threadId);
  });

  it("marks the thread FAILED when every cluster's envelope has no result field", async () => {
    const threadId = await createThread({ companyName: "No Result Co", position: "Engineer", location: "Remote" });
    const runner = async () => JSON.stringify({ session_id: "test" });
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("FAILED");
    expect(report!.researchError).toBe("No facts could be extracted from the research run.");

    await deleteThread(threadId);
  });

  it("one cluster failing does not prevent the others' facts from being saved", async () => {
    const threadId = await createThread({ companyName: "Partial Co", position: "Engineer", location: "Remote" });

    const runner = async (prompt: string) => {
      if (prompt.includes("cultureValues, redFlags")) {
        throw new Error("this cluster crashed");
      }
      if (prompt.includes("companySnapshot, fundingNews")) {
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }]);
      }
      if (prompt.includes("fact-checking a list of researched facts")) {
        return factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }]);
      }
      return factsEnvelope([]);
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    const report = await getThreadReport(threadId);
    expect(report!.researchStatus).toBe("DONE");
    expect(report!.sections.companySnapshot).toHaveLength(1);

    await deleteThread(threadId);
  });

  it("logs per-call and total cost/token/tool-use when the CLI reports usage", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Usage Co", position: "Engineer", location: "Remote" });

    const runner = async (prompt: string) => {
      if (prompt.includes("companySnapshot, fundingNews")) {
        return factsEnvelopeWithUsage(
          [{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }],
          { costUsd: 0.05, numTurns: 4 }
        );
      }
      if (prompt.includes("fact-checking a list of researched facts")) {
        return factsEnvelopeWithUsage(
          [{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }],
          { costUsd: 0.2, numTurns: 2 }
        );
      }
      return factsEnvelopeWithUsage([], { costUsd: 0.01, numTurns: 1 });
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await engine.research({ ...input, threadId });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("company fundamentals found 1 fact(s) — $0.050, 4 turns"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("TOTAL usage across 6 calls"));

    await deleteThread(threadId);
  });

  it("routes cluster calls through the runner and the verify call through the separate verifyRunner", async () => {
    const threadId = await createThread({ companyName: "Two Runners Co", position: "Engineer", location: "Remote" });

    const clusterRunner = vi.fn(async (_prompt: string, _threadId: string) =>
      factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }])
    );
    const verifyRunner = vi.fn(async (_prompt: string, _threadId: string) =>
      factsEnvelope([{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }])
    );
    const engine = new ClaudeCodeCliResearchEngine(clusterRunner, verifyRunner);

    await engine.research({ ...input, threadId });

    expect(clusterRunner).toHaveBeenCalledTimes(5);
    expect(verifyRunner).toHaveBeenCalledTimes(1);
    expect(verifyRunner.mock.calls[0][0]).toContain("fact-checking a list of researched facts");

    await deleteThread(threadId);
  });

  it("never throws — even if the thread is deleted out from under it mid-research", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const threadId = await createThread({ companyName: "Vanishing Co", position: "Engineer", location: "Remote" });
    const resultText = JSON.stringify({
      facts: [{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }],
    });
    let deleted = false;
    const runner = async () => {
      if (!deleted) {
        deleted = true;
        await deleteThread(threadId);
      }
      return fakeEnvelope(resultText);
    };
    const engine = new ClaudeCodeCliResearchEngine(runner, runner);

    await expect(engine.research({ ...input, threadId })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to record failure too"));
  });
});
