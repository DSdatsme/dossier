import { describe, it, expect } from "vitest";
import { mergeResearchFacts } from "./researchMerge";

describe("mergeResearchFacts", () => {
  it("concatenates facts from every cluster", () => {
    const merged = mergeResearchFacts([
      [{ section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" }],
      [{ section: "techStack", content: "Go", sourceDetail: "stackshare.io" }],
    ]);

    expect(merged).toEqual([
      { section: "companySnapshot", content: "Founded: 2020", sourceDetail: "example.com" },
      { section: "techStack", content: "Go", sourceDetail: "stackshare.io" },
    ]);
  });

  it("dedupes sources facts citing the same domain across clusters", () => {
    const merged = mergeResearchFacts([
      [{ section: "sources", content: "glassdoor.com — reviews and ratings", sourceDetail: "glassdoor.com" }],
      [{ section: "sources", content: "glassdoor.com — interview experiences", sourceDetail: "glassdoor.com" }],
      [{ section: "sources", content: "levels.fyi — compensation data", sourceDetail: "levels.fyi" }],
    ]);

    expect(merged).toEqual([
      { section: "sources", content: "glassdoor.com — reviews and ratings", sourceDetail: "glassdoor.com" },
      { section: "sources", content: "levels.fyi — compensation data", sourceDetail: "levels.fyi" },
    ]);
  });

  it("keeps duplicate content in non-sources sections untouched", () => {
    const merged = mergeResearchFacts([
      [{ section: "techStack", content: "Go", sourceDetail: "a.com" }],
      [{ section: "techStack", content: "Go", sourceDetail: "b.com" }],
    ]);

    expect(merged).toHaveLength(2);
  });

  it("returns an empty array when every cluster is empty", () => {
    expect(mergeResearchFacts([[], [], []])).toEqual([]);
  });

  it("handles a sources fact with no ' — ' separator without crashing", () => {
    const merged = mergeResearchFacts([[{ section: "sources", content: "just a domain", sourceDetail: "x" }]]);
    expect(merged).toEqual([{ section: "sources", content: "just a domain", sourceDetail: "x" }]);
  });
});
