import { describe, it, expect } from "vitest";
import { parseLabelValue, findBySlot, excludingSlots } from "./factParsing";
import type { FactView } from "./types";

const fact = (content: string): FactView => ({
  id: content,
  content,
  sourceType: "RESEARCHED",
  sourceDetail: "test",
});

describe("parseLabelValue", () => {
  it("splits a 'Label: Value' fact into its parts", () => {
    expect(parseLabelValue("Founded: 2016")).toEqual({ label: "Founded", value: "2016" });
  });

  it("returns null for a plain sentence with no label prefix", () => {
    expect(parseLabelValue("Builds autonomous warehouse robotics.")).toBeNull();
  });

  it("only splits on the first colon, so values may contain their own colons", () => {
    expect(parseLabelValue("Reports to: central platform: engineering org")).toEqual({
      label: "Reports to",
      value: "central platform: engineering org",
    });
  });
});

describe("findBySlot", () => {
  it("finds a fact whose label matches, case-insensitively", () => {
    const facts = [fact("Founded: 2016"), fact("Employees: ~600")];
    expect(findBySlot(facts, "founded")?.content).toBe("Founded: 2016");
  });

  it("returns undefined when no fact matches the slot", () => {
    const facts = [fact("Founded: 2016")];
    expect(findBySlot(facts, "Employees")).toBeUndefined();
  });
});

describe("excludingSlots", () => {
  it("removes facts matching any of the given slot labels", () => {
    const facts = [fact("Glassdoor: 4.0/5"), fact("Work-Life Balance: 3.8"), fact("Pro: good culture")];
    const result = excludingSlots(facts, ["Glassdoor"]);
    expect(result.map((f) => f.content)).toEqual(["Work-Life Balance: 3.8", "Pro: good culture"]);
  });
});
