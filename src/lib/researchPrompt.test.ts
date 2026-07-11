import { describe, it, expect } from "vitest";
import { buildResearchPrompt } from "./researchPrompt";

describe("buildResearchPrompt", () => {
  it("includes the company name, position, and location", () => {
    const prompt = buildResearchPrompt({
      threadId: "t1",
      companyName: "Acme Robotics",
      companyDomain: null,
      position: "SRE",
      location: "Remote",
    });

    expect(prompt).toContain("Acme Robotics");
    expect(prompt).toContain("SRE");
    expect(prompt).toContain("Remote");
  });

  it("includes the domain when given, and omits any domain mention when null", () => {
    const withDomain = buildResearchPrompt({
      threadId: "t1",
      companyName: "Acme Robotics",
      companyDomain: "acme.example",
      position: "SRE",
      location: "Remote",
    });
    expect(withDomain).toContain("acme.example");

    const withoutDomain = buildResearchPrompt({
      threadId: "t1",
      companyName: "Acme Robotics",
      companyDomain: null,
      position: "SRE",
      location: "Remote",
    });
    expect(withoutDomain).not.toContain("null");
  });

  it("lists all 9 valid section names", () => {
    const prompt = buildResearchPrompt({
      threadId: "t1",
      companyName: "Acme Robotics",
      companyDomain: null,
      position: "SRE",
      location: "Remote",
    });

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
    ]) {
      expect(prompt).toContain(section);
    }
  });

  it("instructs JSON-only output and forbids fabrication", () => {
    const prompt = buildResearchPrompt({
      threadId: "t1",
      companyName: "Acme Robotics",
      companyDomain: null,
      position: "SRE",
      location: "Remote",
    });

    expect(prompt).toContain('"facts"');
    expect(prompt.toLowerCase()).toContain("fabricat");
  });
});
