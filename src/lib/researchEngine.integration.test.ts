import { describe, it, expect } from "vitest";
import { ClaudeCodeCliResearchEngine } from "./researchEngine";
import { createThread, deleteThread } from "./threads";
import { getThreadReport } from "./reports";

/**
 * Real end-to-end checks against the live `claude` CLI, real WebSearch/WebFetch,
 * and real internet data — not the injected-fake-runner unit tests elsewhere in
 * this codebase. These make real API calls, take a long time (each company can
 * run all the way up to the research/verify timeouts), and cost real money, so
 * they are gated behind RUN_INTEGRATION_TESTS and are not part of `npm test`/CI.
 *
 * Run with: npm run test:integration
 *
 * These are deliberately structural, not exact-fact assertions: known facts
 * about a company (employee counts, ratings, leadership) drift over time, so
 * hard-coding them would make this suite flaky by design. Instead this checks
 * that a famous, heavily-documented company never comes back thin in the
 * sections that should always have abundant public data, and logs the full
 * output so a human can skim it for quality.
 */
const TEST_TIMEOUT_MS = 30 * 60 * 1000;

const NEVER_EMPTY_SECTIONS = ["companySnapshot", "cultureValues", "techStack", "compensation", "redFlags", "interviewProcess", "sources"];
const SOFT_CHECK_SECTIONS = ["fundingNews", "companyAtLocation", "roleSpecifics"];

const COMPANIES = [
  {
    companyName: "Google",
    companyDomain: "google.com",
    position: "Developer Relations Engineer",
    location: "Mountain View, CA",
  },
  {
    companyName: "Flipkart",
    companyDomain: "flipkart.com",
    position: "Software Development Engineer",
    location: "Bengaluru, Karnataka",
  },
  {
    companyName: "Amazon",
    companyDomain: "amazon.com",
    position: "Software Development Engineer",
    location: "Seattle, WA",
  },
];

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)("ClaudeCodeCliResearchEngine (real CLI, real internet)", () => {
  it.each(COMPANIES)(
    "researches $companyName and produces well-populated, sensible facts",
    async ({ companyName, companyDomain, position, location }) => {
      const threadId = await createThread({ companyName, companyDomain, position, location });
      const engine = new ClaudeCodeCliResearchEngine();

      try {
        await engine.research({ threadId, companyName, companyDomain, position, location });

        const report = await getThreadReport(threadId);
        expect(report).not.toBeNull();

        console.log(`\n=== ${companyName} research result ===`);
        console.log(`status: ${report!.researchStatus}, error: ${report!.researchError ?? "(none)"}`);
        console.log(JSON.stringify(report!.sections, null, 2));

        expect(report!.researchStatus).toBe("DONE");

        for (const section of NEVER_EMPTY_SECTIONS) {
          const facts = report!.sections[section] ?? [];
          expect(facts.length, `expected at least one "${section}" fact for ${companyName}`).toBeGreaterThan(0);
        }

        for (const section of SOFT_CHECK_SECTIONS) {
          const facts = report!.sections[section] ?? [];
          if (facts.length === 0) {
            console.log(`(note: "${section}" came back empty for ${companyName} — not a hard failure, but worth a look)`);
          }
        }

        const allFacts = Object.values(report!.sections).flat();
        for (const fact of allFacts) {
          expect(fact.content.trim().length, `empty fact content in section with content "${JSON.stringify(fact)}"`).toBeGreaterThan(0);
          expect(fact.sourceDetail.trim().length, `empty sourceDetail for fact "${fact.content}"`).toBeGreaterThan(0);
        }
      } finally {
        await deleteThread(threadId);
      }
    },
    TEST_TIMEOUT_MS
  );
});
