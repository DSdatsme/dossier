import { describe, it, expect } from "vitest";
import {
  buildCompanyFundamentalsPrompt,
  buildEmployeeExperiencePrompt,
  buildRoleTeamTechPrompt,
  buildCompensationPrompt,
  buildInterviewProcessPrompt,
  buildResearchVerifyPrompt,
  buildSectionDedupPrompt,
  SECTION_TO_BUILDER,
} from "./researchPrompts";

const input = {
  threadId: "t1",
  companyName: "Acme Robotics",
  companyDomain: null,
  position: "SRE",
  location: "Remote",
};

describe("cluster prompt builders", () => {
  it.each([
    ["buildCompanyFundamentalsPrompt", buildCompanyFundamentalsPrompt, ["companySnapshot", "fundingNews"]],
    ["buildEmployeeExperiencePrompt", buildEmployeeExperiencePrompt, ["cultureValues", "redFlags"]],
    ["buildRoleTeamTechPrompt", buildRoleTeamTechPrompt, ["roleSpecifics", "techStack", "companyAtLocation"]],
    ["buildCompensationPrompt", buildCompensationPrompt, ["compensation"]],
    ["buildInterviewProcessPrompt", buildInterviewProcessPrompt, ["interviewProcess"]],
  ] as const)("%s includes the company/position/location and its own sections only", (_name, builder, sections) => {
    const prompt = builder(input);

    expect(prompt).toContain("Acme Robotics");
    expect(prompt).toContain("SRE");
    expect(prompt).toContain("Remote");
    for (const section of sections) {
      expect(prompt).toContain(section);
    }
  });

  it.each([
    buildCompanyFundamentalsPrompt,
    buildEmployeeExperiencePrompt,
    buildRoleTeamTechPrompt,
    buildCompensationPrompt,
    buildInterviewProcessPrompt,
  ])("instructs JSON-only output with sourceUrl, forbids fabrication, and includes the region-adaptive sourcing note", (builder) => {
    const prompt = builder(input);

    expect(prompt).toContain('"facts"');
    expect(prompt).toContain('"sourceUrl"');
    expect(prompt.toLowerCase()).toContain("fabricat");
    expect(prompt).toContain("Pick sources appropriate to this company's likely region");
  });

  it("includes the domain when given, and omits any domain mention when null", () => {
    const withDomain = buildCompanyFundamentalsPrompt({ ...input, companyDomain: "acme.example" });
    expect(withDomain).toContain("acme.example");

    const withoutDomain = buildCompanyFundamentalsPrompt({ ...input, companyDomain: null });
    expect(withoutDomain).not.toContain("null");
  });

  it("employee experience prompt calls out layoff checking explicitly", () => {
    expect(buildEmployeeExperiencePrompt(input).toLowerCase()).toContain("layoff");
  });

  it("role/team/tech prompt prioritizes the company's own engineering blog", () => {
    expect(buildRoleTeamTechPrompt(input).toLowerCase()).toContain("engineering or tech blog");
  });

  it("compensation prompt labels related-role estimates clearly rather than as authoritative", () => {
    const prompt = buildCompensationPrompt(input);
    expect(prompt).toContain("related-role estimate");
  });

  it("interview process prompt asks for round count, question themes, and experience sentiment", () => {
    const prompt = buildInterviewProcessPrompt(input);
    expect(prompt.toLowerCase()).toContain("round count");
    expect(prompt.toLowerCase()).toContain("question themes");
    expect(prompt.toLowerCase()).toContain("experience");
  });

  // Regression test: real integration-test runs showed cluster calls taking 16-25
  // turns each, with 94% of tokens spent re-reading a growing conversation via
  // cache rather than doing new research — turn count, not search/fetch count,
  // is what drives cost. Every cluster must cap it explicitly.
  it.each([
    buildCompanyFundamentalsPrompt,
    buildEmployeeExperiencePrompt,
    buildRoleTeamTechPrompt,
    buildCompensationPrompt,
    buildInterviewProcessPrompt,
  ])("caps searches to keep the run economical", (builder) => {
    const prompt = builder(input);
    expect(prompt.toLowerCase()).toContain("be economical");
    expect(prompt.toLowerCase()).toContain("at most 6");
  });

  // Regression test: every cluster must ask for "sources" facts too, not just its own
  // sections — mergeResearchFacts dedupes sources by domain across clusters, which only
  // matters if clusters actually produce them. An earlier version of these prompts never
  // listed "sources" as a valid section anywhere, so the real pipeline always came back
  // with an empty sources list (caught by the integration test against real Google data).
  it.each([
    buildCompanyFundamentalsPrompt,
    buildEmployeeExperiencePrompt,
    buildRoleTeamTechPrompt,
    buildCompensationPrompt,
    buildInterviewProcessPrompt,
  ])("lists sources as a valid section and explains its format", (builder) => {
    const prompt = builder(input);
    expect(prompt).toContain("sources.");
    expect(prompt).toContain('- sources: "domain — short description of what you found there"');
  });
});

describe("buildResearchVerifyPrompt", () => {
  it("includes the given facts as JSON and instructs pruning only, never adding or editing", () => {
    const facts = [
      { section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com", sourceUrl: "https://example.com/about" },
    ];

    const prompt = buildResearchVerifyPrompt(facts);

    expect(prompt).toContain("Founded: 2020");
    expect(prompt).toContain("https://example.com/about");
    expect(prompt.toLowerCase()).toContain("never add a new fact");
    expect(prompt.toLowerCase()).toContain("never edit a fact");
  });

  // Regression test: the verify pass used to WebFetch-recheck every fact with a
  // sourceUrl, which meant its turn count (and thus cost) scaled with fact count —
  // a real run hit the account's entire session quota mid-verification because of
  // this. It must now be a pure judgment pass with no tool access at all.
  it("declares no tool access and instructs a judgment-only review", () => {
    const prompt = buildResearchVerifyPrompt([]);
    expect(prompt.toLowerCase()).toContain("do not have any tool access");
    expect(prompt.toLowerCase()).toContain("own reasoning");
  });
});

describe("focusNote threading", () => {
  it.each([
    buildCompanyFundamentalsPrompt,
    buildEmployeeExperiencePrompt,
    buildRoleTeamTechPrompt,
    buildCompensationPrompt,
    buildInterviewProcessPrompt,
  ])("includes the focus note when given, and omits the focus-note line when absent", (builder) => {
    const withNote = builder(input, "Focus specifically on Developer Relations Engineer roles.");
    expect(withNote).toContain("Additional focus for this specific research pass: Focus specifically on Developer Relations Engineer roles.");

    const withoutNote = builder(input);
    expect(withoutNote).not.toContain("Additional focus for this specific research pass");
  });

  it("combines the focus note with employee-experience's fixed layoff-check instruction rather than replacing it", () => {
    const prompt = buildEmployeeExperiencePrompt(input, "Focus on remote-work culture specifically.");
    expect(prompt.toLowerCase()).toContain("layoff");
    expect(prompt).toContain("Additional focus for this specific research pass: Focus on remote-work culture specifically.");
  });
});

describe("SECTION_TO_BUILDER", () => {
  it("maps all 9 targetable sections to a builder function", () => {
    const expectedSections = [
      "companySnapshot",
      "fundingNews",
      "cultureValues",
      "redFlags",
      "roleSpecifics",
      "techStack",
      "companyAtLocation",
      "compensation",
      "interviewProcess",
    ];
    expect(Object.keys(SECTION_TO_BUILDER).sort()).toEqual(expectedSections.sort());
  });

  it("does not include sources, since it's a meta-aggregation section, not a research topic", () => {
    expect(SECTION_TO_BUILDER.sources).toBeUndefined();
  });
});

describe("buildSectionDedupPrompt", () => {
  it("includes both fact lists and instructs additive-only, near-duplicate-only filtering", () => {
    const existing = [{ section: "compensation", content: "Role: ~$150k-$170k", sourceDetail: "glassdoor.com" }];
    const newFacts = [{ section: "compensation", content: "DevRel Engineer: ~$163k-$237k", sourceDetail: "google careers" }];

    const prompt = buildSectionDedupPrompt(existing, newFacts);

    expect(prompt).toContain("$150k-$170k");
    expect(prompt).toContain("$163k-$237k");
    expect(prompt.toLowerCase()).toContain("near-duplicate");
    expect(prompt.toLowerCase()).toContain("do not have any tool access");
  });

  it("instructs a JSON facts array output matching the research-fact shape", () => {
    const prompt = buildSectionDedupPrompt([], []);
    expect(prompt).toContain('"facts"');
    expect(prompt).toContain('"section"');
  });
});
