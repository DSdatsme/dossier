import { describe, it, expect } from "vitest";
import { buildChatPrompt } from "./chatPrompt";
import type { ThreadReport } from "./types";

function fixtureReport(overrides: Partial<ThreadReport> = {}): ThreadReport {
  return {
    id: "thread-1",
    companyName: "Acme Robotics",
    position: "Senior Engineer",
    location: "Remote",
    companyDomain: null,
    confirmedTotalRounds: null,
    confirmedTotalRoundsSource: null,
    researchStatus: "DONE",
    researchError: null,
    sections: {
      compensation: [
        { id: "fct-1", content: "Role: ~$180k-$210k", sourceType: "USER_PROVIDED", sourceDetail: "you" },
      ],
    },
    rounds: [
      {
        id: "rnd-1",
        name: "Phone Screen",
        order: 1,
        status: "COMPLETED",
        prepMaterial: [{ id: "fct-2", content: "Background & motivation.", sourceType: "RESEARCHED", sourceDetail: "generic" }],
        smartQuestions: [],
        yourNotes: [],
        interviewers: [
          { id: "intv-1", name: "Jordan Lee", role: "Talent Partner", tenure: "2 yrs", background: null },
        ],
      },
    ],
    ...overrides,
  };
}

describe("buildChatPrompt", () => {
  it("includes the company name, position, and location", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });

    expect(prompt).toContain("Acme Robotics");
    expect(prompt).toContain("Senior Engineer");
    expect(prompt).toContain("Remote");
  });

  it("serializes current facts, rounds, and interviewers with their ids", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });

    expect(prompt).toContain("fct-1");
    expect(prompt).toContain("Role: ~$180k-$210k");
    expect(prompt).toContain("rnd-1");
    expect(prompt).toContain("Phone Screen");
    expect(prompt).toContain("fct-2");
    expect(prompt).toContain("intv-1");
    expect(prompt).toContain("Jordan Lee");
  });

  it("lists all 9 valid thread-level section names, the 3 round-level section names, and the 3 round statuses", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });

    for (const section of [
      "companySnapshot",
      "fundingNews",
      "companyAtLocation",
      "cultureValues",
      "roleSpecifics",
      "techStack",
      "compensation",
      "redFlags",
      "sources",
      "prepMaterial",
      "smartQuestions",
      "yourNotes",
    ]) {
      expect(prompt).toContain(section);
    }
    for (const status of ["UPCOMING", "COMPLETED", "NOT_HAPPENING"]) {
      expect(prompt).toContain(status);
    }
  });

  it("formats prior chat history with You:/Assistant: prefixes, and quotes the new message", () => {
    const prompt = buildChatPrompt({
      report: fixtureReport(),
      history: [
        { id: "m1", from: "you", text: "Did the phone screen yesterday.", status: "DONE" },
        { id: "m2", from: "assistant", text: "Got it.", status: "DONE" },
      ],
      newMessage: "Next round is an onsite next week.",
    });

    expect(prompt).toContain("You: Did the phone screen yesterday.");
    expect(prompt).toContain("Assistant: Got it.");
    expect(prompt).toContain('"Next round is an onsite next week."');
  });

  it("notes when there is no earlier history", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt).toContain("no earlier messages");
  });

  it("instructs JSON-only output with a reply and operations, and forbids fabrication", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });

    expect(prompt).toContain('"reply"');
    expect(prompt).toContain('"operations"');
    expect(prompt.toLowerCase()).toContain("fabricat");
  });
});
