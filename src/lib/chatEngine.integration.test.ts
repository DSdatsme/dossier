import { describe, it, expect } from "vitest";
import { ClaudeCodeCliChatEngine } from "./chatEngine";
import { createThread, deleteThread } from "./threads";
import { prisma } from "./db";

/**
 * Real end-to-end checks against the live `claude` CLI — not the
 * injected-fake-runner unit tests elsewhere in this codebase. Gated behind
 * RUN_INTEGRATION_TESTS; not part of `npm test`/CI. Run with:
 *
 *   npm run test:integration
 *
 * Chat's job is understanding conversation, not researching, so these use
 * synthetic scenarios rather than famous companies. The scenario below
 * specifically replays the shape of a real bug found in production usage: the
 * model linked a newly-mentioned interviewer to an existing, already-completed
 * round by guessing, while its own reply simultaneously asked whether the
 * guess was right. This is exactly the failure mode the verify-before-apply
 * pass and the round-restructure prompt guidance were added to catch — a
 * fake-runner unit test cannot prove the real model actually avoids it.
 */
const TEST_TIMEOUT_MS = 15 * 60 * 1000;

async function seedTurn(threadId: string, userText: string): Promise<string> {
  await prisma.message.create({ data: { threadId, role: "USER", text: userText, status: "DONE" } });
  const assistantMessage = await prisma.message.create({ data: { threadId, role: "ASSISTANT", text: "", status: "PENDING" } });
  return assistantMessage.id;
}

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)("ClaudeCodeCliChatEngine (real CLI)", () => {
  it(
    "marks a clearly-referenced, unambiguous round as completed",
    async () => {
      const threadId = await createThread({ companyName: "Sanity Check Co", position: "Engineer", location: "Remote" });
      try {
        await prisma.round.create({ data: { threadId, name: "Phone Screen", order: 1, status: "UPCOMING", confirmedSource: "you" } });
        const assistantMessageId = await seedTurn(threadId, "Just finished the phone screen, it went well.");

        const engine = new ClaudeCodeCliChatEngine();
        await engine.respond(threadId, assistantMessageId);

        const round = await prisma.round.findFirstOrThrow({ where: { threadId, name: "Phone Screen" } });
        const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
        console.log(`\n=== sanity check reply ===\n${message.text}`);

        expect(round.status).toBe("COMPLETED");
        expect(message.status).toBe("DONE");
      } finally {
        await deleteThread(threadId);
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "does not guess-assign a newly-mentioned interviewer to an unrelated, already-completed round",
    async () => {
      const threadId = await createThread({ companyName: "Regression Check Co", position: "Engineer", location: "Remote" });
      try {
        const hiringManagerRound = await prisma.round.create({
          data: { threadId, name: "Hiring Manager Interview", order: 1, status: "COMPLETED", confirmedSource: "recruiter email" },
        });
        const originalInterviewer = await prisma.interviewerProfile.create({
          data: { threadId, name: "Original Person", role: "Recruiter", sourceDetail: "recruiter email" },
        });
        await prisma.roundInterviewer.create({ data: { roundId: hiringManagerRound.id, profileId: originalInterviewer.id } });
        for (const [name, order] of [
          ["Technical Round", 2],
          ["Architecture Round", 3],
          ["Cross-Functional Round", 4],
          ["Executive Round", 5],
          ["Final Round", 6],
        ] as const) {
          await prisma.round.create({ data: { threadId, name, order, status: "COMPLETED", confirmedSource: "recruiter email" } });
        }

        const assistantMessageId = await seedTurn(
          threadId,
          "There's actually a 7th round. It's the hiring manager round and it's with Alex Chen."
        );

        const engine = new ClaudeCodeCliChatEngine();
        await engine.respond(threadId, assistantMessageId);

        const message = await prisma.message.findUniqueOrThrow({ where: { id: assistantMessageId } });
        const linksOnOriginalRound = await prisma.roundInterviewer.findMany({
          where: { roundId: hiringManagerRound.id },
          include: { profile: true },
        });
        console.log(`\n=== regression check reply ===\n${message.text}`);
        console.log(`interviewers linked to the original "Hiring Manager Interview" round: ${linksOnOriginalRound.map((l) => l.profile.name).join(", ")}`);

        // The one behavior that must never happen: Alex Chen getting attached to
        // the pre-existing, already-completed "Hiring Manager Interview" round.
        // Asking for clarification or creating a genuinely new round are both
        // fine — only silently reassigning the existing round is the bug.
        const gotGuessAssigned = linksOnOriginalRound.some((link) => link.profile.name.toLowerCase().includes("alex chen"));
        expect(gotGuessAssigned).toBe(false);
      } finally {
        await deleteThread(threadId);
      }
    },
    TEST_TIMEOUT_MS
  );
});
