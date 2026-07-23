import { describe, it, expect } from "vitest";
import { buildChatPrompt, buildChatVerifyPrompt } from "./chatPrompt";
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
    researchingSections: [],
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

  it("lists all 10 valid thread-level section names, the 3 round-level section names, and the 3 round statuses", () => {
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
      "interviewProcess",
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

  it("instructs asking for clarification instead of forcing a conflicting round-structure description into an existing round", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt.toLowerCase()).toContain("conflicts with the round structure already in the current state");
  });

  it("instructs not guessing while also hedging in the reply", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt.toLowerCase()).toContain("do not both guess and hedge");
  });

  it("includes worked examples", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt).toContain("Examples:");
    expect(prompt).toContain("recruiter said the range is 150-170k");
  });

  it("lists researchSection as a valid operation shape covering the 9 researchable sections, and explains it triggers a background pass", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });

    expect(prompt).toContain('"researchSection"');
    expect(prompt).toContain("focusNote");
    for (const section of [
      "companySnapshot",
      "fundingNews",
      "cultureValues",
      "redFlags",
      "roleSpecifics",
      "techStack",
      "companyAtLocation",
      "compensation",
      "interviewProcess",
    ]) {
      expect(prompt).toContain(section);
    }
    expect(prompt.toLowerCase()).toContain("background research pass");
  });

  // Regression test: the prior test only checks that each of the 9 researchable
  // section names appears SOMEWHERE in the prompt — but all 9 also already appear
  // in the unrelated, 10-entry THREAD_SECTIONS list used by addFact, so an
  // accidental aliasing of RESEARCHABLE_SECTIONS to THREAD_SECTIONS would still
  // pass that test. Pin the exact researchSection shape line, in order, to prove
  // it's genuinely the 9-entry list and not the 10-entry one (which includes
  // "sources").
  it("pins the researchSection section list to exactly the 9 targetable sections, in order, excluding sources", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt).toContain(
      '"op":"researchSection","section":"<one of: companySnapshot, fundingNews, cultureValues, redFlags, roleSpecifics, techStack, companyAtLocation, compensation, interviewProcess>"'
    );
  });

  it("includes a worked example for researchSection with a specific focus note", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt).toContain("look harder at the DevRel-specific compensation");
    expect(prompt).toContain('"researchSection"');
  });

  it("instructs not proposing researchSection again for a section already listed as in-progress", () => {
    const prompt = buildChatPrompt({ report: fixtureReport(), history: [], newMessage: "hello" });
    expect(prompt.toLowerCase()).toContain("researchingsections");
    expect(prompt.toLowerCase()).toContain("already being looked into");
  });

  it("serializes currently in-flight section research jobs into the current state", () => {
    const prompt = buildChatPrompt({
      report: fixtureReport({ researchingSections: ["compensation"] }),
      history: [],
      newMessage: "hello",
    });
    expect(prompt).toContain('"researchingSections":["compensation"]');
  });
});

describe("buildChatVerifyPrompt", () => {
  it("includes the current state, the user's message, and the proposed operations", () => {
    const operations = [{ op: "setConfirmedTotalRounds", count: 4, sourceDetail: "recruiter email" }];
    const prompt = buildChatVerifyPrompt({ report: fixtureReport(), newMessage: "There are 4 rounds total.", operations });

    expect(prompt).toContain("fct-1");
    expect(prompt).toContain('"There are 4 rounds total."');
    expect(prompt).toContain('"setConfirmedTotalRounds"');
  });

  it("instructs JSON-only output with confirmedOperations and a clarifyingNote, and never adding new operations", () => {
    const prompt = buildChatVerifyPrompt({ report: fixtureReport(), newMessage: "hello", operations: [] });

    expect(prompt).toContain('"confirmedOperations"');
    expect(prompt).toContain('"clarifyingNote"');
    expect(prompt.toLowerCase()).toContain("never add a new operation");
  });

  it("references the guess-and-hedge failure mode explicitly", () => {
    const prompt = buildChatVerifyPrompt({ report: fixtureReport(), newMessage: "hello", operations: [] });
    expect(prompt.toLowerCase()).toContain("guessing");
  });

  // Regression test: live testing showed the verify pass rejecting nearly every
  // researchSection operation, reasoning that its target (a role/company detail)
  // "doesn't appear in the tracked facts" — the same "don't guess" lens applied to
  // addFact/correctFact, which is the wrong question for an operation whose entire
  // point is to go find something not yet known.
  it("instructs not dropping researchSection just because its target isn't already a tracked fact", () => {
    const prompt = buildChatVerifyPrompt({ report: fixtureReport(), newMessage: "hello", operations: [] });
    expect(prompt.toLowerCase()).toContain('"researchsection" operation needs a different question');
    expect(prompt.toLowerCase()).toContain("not already known");
  });
});
