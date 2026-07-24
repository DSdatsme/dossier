import { describe, it, expect } from "vitest";
import { parseResearchFacts } from "./researchParsing";

describe("parseResearchFacts", () => {
  it("parses a valid facts array, defaulting sourceDetail when omitted", () => {
    const text = JSON.stringify({
      facts: [
        { section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" },
        { section: "techStack", content: "Go" },
      ],
    });

    const facts = parseResearchFacts(text);

    expect(facts).toEqual([
      { section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" },
      { section: "techStack", content: "Go", sourceDetail: "web research" },
    ]);
  });

  it("extracts JSON wrapped in a fenced code block", () => {
    const text = 'Here you go:\n```json\n{"facts": [{"section": "techStack", "content": "Go", "sourceDetail": "x"}]}\n```\nDone.';

    const facts = parseResearchFacts(text);

    expect(facts).toEqual([{ section: "techStack", content: "Go", sourceDetail: "x" }]);
  });

  it("drops facts with an invalid section", () => {
    const text = JSON.stringify({
      facts: [
        { section: "notARealSection", content: "should be dropped", sourceDetail: "x" },
        { section: "techStack", content: "Go", sourceDetail: "x" },
      ],
    });

    expect(parseResearchFacts(text)).toEqual([{ section: "techStack", content: "Go", sourceDetail: "x" }]);
  });

  it("drops facts with empty content", () => {
    const text = JSON.stringify({
      facts: [
        { section: "techStack", content: "", sourceDetail: "x" },
        { section: "techStack", content: "Go", sourceDetail: "x" },
      ],
    });

    expect(parseResearchFacts(text)).toEqual([{ section: "techStack", content: "Go", sourceDetail: "x" }]);
  });

  it("includes sourceUrl when present, and omits it when absent", () => {
    const text = JSON.stringify({
      facts: [
        { section: "techStack", content: "Go", sourceDetail: "stackshare.io", sourceUrl: "https://stackshare.io/acme" },
        { section: "techStack", content: "Kubernetes", sourceDetail: "stackshare.io" },
      ],
    });

    expect(parseResearchFacts(text)).toEqual([
      { section: "techStack", content: "Go", sourceDetail: "stackshare.io", sourceUrl: "https://stackshare.io/acme" },
      { section: "techStack", content: "Kubernetes", sourceDetail: "stackshare.io" },
    ]);
  });

  it("accepts the interviewProcess section", () => {
    const text = JSON.stringify({
      facts: [{ section: "interviewProcess", content: "Commonly 4 rounds over 3 weeks.", sourceDetail: "glassdoor.com" }],
    });

    expect(parseResearchFacts(text)).toEqual([
      { section: "interviewProcess", content: "Commonly 4 rounds over 3 weeks.", sourceDetail: "glassdoor.com" },
    ]);
  });

  it("returns an empty array for malformed JSON", () => {
    expect(parseResearchFacts("this is not json at all")).toEqual([]);
  });

  it("returns an empty array when the facts key is missing or not an array", () => {
    expect(parseResearchFacts(JSON.stringify({ notFacts: [] }))).toEqual([]);
    expect(parseResearchFacts(JSON.stringify({ facts: "not an array" }))).toEqual([]);
  });

  it("prefers the last fenced JSON block over an earlier placeholder/example block", () => {
    const text = `Example format:
\`\`\`json
{"facts": [{"section": "companySnapshot", "content": "ILLUSTRATIVE PLACEHOLDER", "sourceDetail": "example.com"}]}
\`\`\`

Real answer:
\`\`\`json
{"facts": [{"section": "techStack", "content": "Go", "sourceDetail": "docs"}]}
\`\`\``;

    expect(parseResearchFacts(text)).toEqual([{ section: "techStack", content: "Go", sourceDetail: "docs" }]);
  });

  it("prefers the last fenced JSON block over an earlier empty-facts stub", () => {
    const text = `Example format:
\`\`\`json
{"facts": []}
\`\`\`

Actual result:
\`\`\`json
{"facts": [{"section": "techStack", "content": "Go", "sourceDetail": "docs"}]}
\`\`\``;

    expect(parseResearchFacts(text)).toEqual([{ section: "techStack", content: "Go", sourceDetail: "docs" }]);
  });
});
