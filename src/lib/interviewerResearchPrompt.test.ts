import { describe, it, expect } from "vitest";
import { buildInterviewerResearchPrompt, parseInterviewerResearch } from "./interviewerResearchPrompt";

describe("buildInterviewerResearchPrompt", () => {
  it("includes the name and company", () => {
    const prompt = buildInterviewerResearchPrompt({ name: "Jane Doe", companyName: "Acme Robotics", knownRole: null });
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Acme Robotics");
  });

  it("includes the known role when given, and omits the role parenthetical when null", () => {
    const withRole = buildInterviewerResearchPrompt({ name: "Jane Doe", companyName: "Acme Robotics", knownRole: "Senior Engineer" });
    expect(withRole).toContain('(role: "Senior Engineer")');

    const withoutRole = buildInterviewerResearchPrompt({ name: "Jane Doe", companyName: "Acme Robotics", knownRole: null });
    expect(withoutRole).not.toContain("(role:");
  });

  it("instructs trying multiple search strategies beyond LinkedIn alone", () => {
    const prompt = buildInterviewerResearchPrompt({ name: "Jane Doe", companyName: "Acme Robotics", knownRole: null });
    expect(prompt.toLowerCase()).toContain("linkedin");
    expect(prompt.toLowerCase()).toContain("github");
    expect(prompt.toLowerCase()).toContain("frequently blocked");
  });

  it("instructs JSON-only output with role/tenure/background and forbids fabrication", () => {
    const prompt = buildInterviewerResearchPrompt({ name: "Jane Doe", companyName: "Acme Robotics", knownRole: null });
    expect(prompt).toContain('"role"');
    expect(prompt).toContain('"tenure"');
    expect(prompt).toContain('"background"');
    expect(prompt.toLowerCase()).toContain("fabricat");
  });
});

describe("parseInterviewerResearch", () => {
  it("parses a full result", () => {
    const text = JSON.stringify({ role: "Staff Engineer", tenure: "5 yrs", background: "Ex-Google, infra team" });
    expect(parseInterviewerResearch(text)).toEqual({ role: "Staff Engineer", tenure: "5 yrs", background: "Ex-Google, infra team" });
  });

  it("converts missing/null/empty fields to null", () => {
    expect(parseInterviewerResearch(JSON.stringify({}))).toEqual({ role: null, tenure: null, background: null });
    expect(parseInterviewerResearch(JSON.stringify({ role: null, tenure: "", background: "  " }))).toEqual({
      role: null,
      tenure: null,
      background: null,
    });
  });

  it("extracts JSON wrapped in a fenced code block", () => {
    const text = '```json\n{"role": "CTO", "tenure": null, "background": null}\n```';
    expect(parseInterviewerResearch(text)).toEqual({ role: "CTO", tenure: null, background: null });
  });

  it("returns null for malformed JSON", () => {
    expect(parseInterviewerResearch("not json at all")).toBeNull();
  });
});
