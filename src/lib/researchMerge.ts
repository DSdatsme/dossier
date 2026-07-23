import type { ParsedFact } from "./researchParsing";

/**
 * Combines facts from the parallel research clusters into one list. The only
 * real merge concern is `sources`: multiple clusters independently citing the
 * same domain (e.g. glassdoor.com) should collapse to one `sources` fact
 * rather than appearing once per cluster that used it. Every other section
 * passes through untouched — clusters don't overlap on any other section.
 */
export function mergeResearchFacts(clusterResults: ParsedFact[][]): ParsedFact[] {
  const merged: ParsedFact[] = [];
  const seenSourceDomains = new Set<string>();

  for (const facts of clusterResults) {
    for (const fact of facts) {
      if (fact.section === "sources") {
        const domain = fact.content.split(" — ")[0]?.trim().toLowerCase();
        if (domain) {
          if (seenSourceDomains.has(domain)) continue;
          seenSourceDomains.add(domain);
        }
      }
      merged.push(fact);
    }
  }

  return merged;
}
