import { prisma } from "./db";
import { spawnClaudeCli, spawnClaudeCliForResearch, spawnClaudeCliForVerify, type CliRunner } from "./researchEngine";
import { buildChatPrompt, buildChatVerifyPrompt } from "./chatPrompt";
import { parseChatResponse, parseChatVerifyResponse, type ChatOperation, type RoundStatusValue } from "./chatParsing";
import { buildInterviewerResearchPrompt, parseInterviewerResearch } from "./interviewerResearchPrompt";
import { SECTION_TO_BUILDER, buildSectionDedupPrompt } from "./researchPrompts";
import { parseResearchFacts } from "./researchParsing";
import { getThreadReport } from "./reports";
import { getThreadMessages } from "./messages";
import type { ThreadReport } from "./types";

export interface ChatEngine {
  respond(threadId: string, assistantMessageId: string): Promise<void>;
}

const MAX_HISTORY_MESSAGES = 20;

export class ClaudeCodeCliChatEngine implements ChatEngine {
  constructor(
    private runner: CliRunner = spawnClaudeCli,
    private deepRunner: CliRunner = spawnClaudeCliForResearch,
    private verifyRunner: CliRunner = spawnClaudeCliForVerify
  ) {}

  async respond(threadId: string, assistantMessageId: string): Promise<void> {
    console.log(`[chat] responding for thread ${threadId}, message ${assistantMessageId}`);
    try {
      const report = await getThreadReport(threadId);
      if (!report) {
        await markFailed(assistantMessageId, "Thread no longer exists.");
        return;
      }

      const allMessages = await getThreadMessages(threadId);
      const priorMessages = allMessages.filter((message) => message.id !== assistantMessageId && message.status !== "PENDING");
      const newMessage = priorMessages[priorMessages.length - 1];
      if (!newMessage || newMessage.from !== "you") {
        await markFailed(assistantMessageId, "No user message found to respond to.");
        return;
      }
      const history = priorMessages.slice(0, -1).slice(-MAX_HISTORY_MESSAGES);

      const prompt = buildChatPrompt({ report, history, newMessage: newMessage.text });

      let stdout: string;
      try {
        stdout = await this.runner(prompt, threadId);
      } catch (error) {
        await markFailed(assistantMessageId, describeError(error));
        return;
      }

      let resultText: string;
      try {
        const envelope = JSON.parse(stdout) as { result?: unknown };
        if (typeof envelope.result !== "string") {
          await markFailed(assistantMessageId, "Chat run returned no result text.");
          return;
        }
        resultText = envelope.result;
      } catch {
        await markFailed(assistantMessageId, "Chat run's output was not valid JSON.");
        return;
      }

      const parsed = parseChatResponse(resultText);
      if (parsed === null) {
        await markFailed(assistantMessageId, "Chat run's reply could not be understood.");
        return;
      }

      const { operations, clarifyingNote } = await this.verifyOperations(report, newMessage.text, parsed.operations, threadId);
      const reply = clarifyingNote ? `${parsed.reply} ${clarifyingNote}` : parsed.reply;

      let createdInterviewers: { id: string; name: string }[];
      let sectionsToResearch: { section: string; focusNote: string }[];
      try {
        const applied = await applyOperations(threadId, operations, {
          initialResearchInFlight: report.researchStatus === "RESEARCHING",
        });
        createdInterviewers = applied.createdInterviewers;
        sectionsToResearch = applied.sectionsToResearch;
      } catch (error) {
        await markFailed(assistantMessageId, describeError(error));
        return;
      }

      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { text: reply, status: "DONE" },
      });
      console.log(`[chat] thread ${threadId}: applied ${operations.length} operation(s), marked DONE`);

      for (const interviewer of createdInterviewers) {
        enrichInterviewer(this.deepRunner, threadId, interviewer.id, interviewer.name, report.companyName).catch((error) => {
          console.error(`[chat] thread ${threadId}: interviewer enrichment for "${interviewer.name}" failed: ${describeError(error)}`);
        });
      }

      for (const { section, focusNote } of sectionsToResearch) {
        researchSectionInBackground(this.deepRunner, this.verifyRunner, threadId, section, focusNote, {
          companyName: report.companyName,
          companyDomain: report.companyDomain,
          position: report.position,
          location: report.location,
        }).catch((error) => {
          console.error(`[chat] thread ${threadId}: section research for "${section}" failed: ${describeError(error)}`);
        });
      }
    } catch (error) {
      await markFailed(assistantMessageId, describeError(error)).catch(() => {
        console.error(`[chat] message ${assistantMessageId}: failed to record failure too (thread likely gone)`);
      });
    }
  }

  private async verifyOperations(
    report: ThreadReport,
    newMessage: string,
    operations: ChatOperation[],
    threadId: string
  ): Promise<{ operations: ChatOperation[]; clarifyingNote: string }> {
    if (operations.length === 0) return { operations, clarifyingNote: "" };

    try {
      const prompt = buildChatVerifyPrompt({ report, newMessage, operations });
      const stdout = await this.runner(prompt, threadId);
      const envelope = JSON.parse(stdout) as { result?: unknown };
      if (typeof envelope.result !== "string") {
        console.error(`[chat] thread ${threadId}: verify pass returned no result text, applying unverified operations`);
        return { operations, clarifyingNote: "" };
      }
      const verified = parseChatVerifyResponse(envelope.result);
      if (verified === null) {
        console.error(`[chat] thread ${threadId}: verify pass response could not be understood, applying unverified operations`);
        return { operations, clarifyingNote: "" };
      }
      return verified;
    } catch (error) {
      console.error(`[chat] thread ${threadId}: verify pass failed (${describeError(error)}), applying unverified operations`);
      return { operations, clarifyingNote: "" };
    }
  }
}

async function markFailed(messageId: string, reason: string): Promise<void> {
  console.error(`[chat] message ${messageId} FAILED: ${reason}`);
  await prisma.message.update({
    where: { id: messageId },
    data: { status: "FAILED", text: `Sorry, I couldn't process that — ${reason}` },
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error during chat.";
}

export async function enrichInterviewer(
  runner: CliRunner,
  threadId: string,
  interviewerId: string,
  interviewerName: string,
  companyName: string
): Promise<void> {
  const existing = await prisma.interviewerProfile.findUnique({ where: { id: interviewerId } });
  if (!existing) return;

  const prompt = buildInterviewerResearchPrompt({ name: interviewerName, companyName, knownRole: existing.role });
  const stdout = await runner(prompt, threadId);
  const envelope = JSON.parse(stdout) as { result?: unknown };
  if (typeof envelope.result !== "string") return;

  const parsed = parseInterviewerResearch(envelope.result);
  if (parsed === null) return;

  await prisma.interviewerProfile.update({
    where: { id: interviewerId },
    data: {
      role: existing.role ?? parsed.role,
      tenure: existing.tenure ?? parsed.tenure,
      background: existing.background ?? parsed.background,
    },
  });
  console.log(`[chat] thread ${threadId}: enriched interviewer profile for "${interviewerName}"`);
}

export async function researchSectionInBackground(
  researchRunner: CliRunner,
  verifyRunner: CliRunner,
  threadId: string,
  section: string,
  focusNote: string,
  input: { companyName: string; companyDomain: string | null; position: string; location: string }
): Promise<void> {
  try {
    const buildPrompt = SECTION_TO_BUILDER[section];
    if (!buildPrompt) return;

    const prompt = buildPrompt({ threadId, ...input }, focusNote || undefined);
    const stdout = await researchRunner(prompt, threadId);
    const envelope = JSON.parse(stdout) as { result?: unknown };
    if (typeof envelope.result !== "string") return;

    const newFacts = parseResearchFacts(envelope.result);
    if (newFacts.length === 0) return;

    const existing = await prisma.fact.findMany({ where: { threadId, section, roundId: null, state: "ACTIVE" } });
    const existingFacts = existing.map((fact) => ({ section: fact.section, content: fact.content, sourceDetail: fact.sourceDetail }));

    let factsToAdd = newFacts;
    try {
      const dedupPrompt = buildSectionDedupPrompt(existingFacts, newFacts);
      const dedupStdout = await verifyRunner(dedupPrompt, threadId);
      const dedupEnvelope = JSON.parse(dedupStdout) as { result?: unknown };
      if (typeof dedupEnvelope.result === "string") {
        factsToAdd = parseResearchFacts(dedupEnvelope.result);
      }
    } catch (error) {
      console.error(`[chat] thread ${threadId}: section dedup pass failed (${describeError(error)}), keeping all new facts`);
    }

    if (factsToAdd.length > 0) {
      await prisma.fact.createMany({
        data: factsToAdd.map((fact) => ({
          threadId,
          section,
          content: fact.content,
          sourceType: "RESEARCHED" as const,
          sourceDetail: fact.sourceDetail,
        })),
      });
    }
    console.log(`[chat] thread ${threadId}: section research for "${section}" added ${factsToAdd.length} fact(s)`);
  } finally {
    await prisma.sectionResearchJob.deleteMany({ where: { threadId, section } }).catch(() => {});
  }
}

async function applyOperations(
  threadId: string,
  operations: ChatOperation[],
  context: { initialResearchInFlight: boolean }
): Promise<{
  createdInterviewers: { id: string; name: string }[];
  sectionsToResearch: { section: string; focusNote: string }[];
}> {
  if (operations.length === 0) return { createdInterviewers: [], sectionsToResearch: [] };

  const createdInterviewers: { id: string; name: string }[] = [];
  const sectionsToResearch: { section: string; focusNote: string }[] = [];

  await prisma.$transaction(async (tx) => {
    const rounds = await tx.round.findMany({ where: { threadId } });
    const roundIdByLowerName = new Map(rounds.map((round) => [round.name.toLowerCase(), round.id]));
    const validRoundIds = new Set(rounds.map((round) => round.id));
    let maxOrder = rounds.reduce((max, round) => Math.max(max, round.order), 0);

    function resolveRoundRef(ref: string): string {
      if (validRoundIds.has(ref)) return ref;
      const byName = roundIdByLowerName.get(ref.toLowerCase());
      if (byName) return byName;
      throw new Error(`Could not find a round named "${ref}".`);
    }

    function registerRound(id: string, name: string): void {
      validRoundIds.add(id);
      roundIdByLowerName.set(name.toLowerCase(), id);
    }

    for (const operation of operations) {
      const result = await applyOneOperation(
        tx,
        threadId,
        operation,
        resolveRoundRef,
        registerRound,
        () => {
          maxOrder += 1;
          return maxOrder;
        },
        context.initialResearchInFlight
      );
      if (result && operation.op === "addInterviewer") {
        createdInterviewers.push({ id: result, name: operation.name });
      }
      if (result && operation.op === "researchSection") {
        sectionsToResearch.push({ section: result, focusNote: operation.focusNote });
      }
    }
  });

  return { createdInterviewers, sectionsToResearch };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function applyOneOperation(
  tx: Tx,
  threadId: string,
  operation: ChatOperation,
  resolveRoundRef: (ref: string) => string,
  registerRound: (id: string, name: string) => void,
  nextOrder: () => number,
  initialResearchInFlight: boolean
): Promise<string | void> {
  switch (operation.op) {
    case "addFact": {
      if (operation.scope === "thread") {
        await tx.fact.create({
          data: {
            threadId,
            section: operation.section,
            content: operation.content,
            sourceType: "USER_PROVIDED",
            sourceDetail: operation.sourceDetail,
          },
        });
      } else {
        const roundId = resolveRoundRef(operation.roundRef);
        await tx.fact.create({
          data: {
            threadId,
            roundId,
            section: operation.section,
            content: operation.content,
            sourceType: "USER_PROVIDED",
            sourceDetail: operation.sourceDetail,
          },
        });
      }
      return;
    }
    case "correctFact": {
      const original = await tx.fact.findUnique({ where: { id: operation.factId } });
      if (!original || original.threadId !== threadId) {
        throw new Error(`Could not find fact "${operation.factId}" to correct.`);
      }
      await tx.fact.update({ where: { id: original.id }, data: { state: "EDITED" } });
      await tx.fact.create({
        data: {
          threadId,
          roundId: original.roundId,
          section: original.section,
          content: operation.content,
          sourceType: "USER_PROVIDED",
          sourceDetail: operation.sourceDetail,
          state: "ACTIVE",
        },
      });
      return;
    }
    case "createRound": {
      const created = await tx.round.create({
        data: {
          threadId,
          name: operation.name,
          order: nextOrder(),
          status: operation.status as RoundStatusValue,
          confirmedSource: operation.sourceDetail,
        },
      });
      registerRound(created.id, created.name);
      return;
    }
    case "updateRoundStatus": {
      const roundId = resolveRoundRef(operation.roundRef);
      await tx.round.update({ where: { id: roundId }, data: { status: operation.status } });
      return;
    }
    case "addInterviewer": {
      const profile = await tx.interviewerProfile.create({
        data: {
          threadId,
          name: operation.name,
          role: operation.role,
          tenure: operation.tenure,
          background: operation.background,
          sourceDetail: operation.sourceDetail,
        },
      });
      if (operation.roundRef) {
        const roundId = resolveRoundRef(operation.roundRef);
        await tx.roundInterviewer.create({ data: { roundId, profileId: profile.id } });
      }
      return profile.id;
    }
    case "setConfirmedTotalRounds": {
      await tx.thread.update({
        where: { id: threadId },
        data: { confirmedTotalRounds: operation.count, confirmedTotalRoundsSource: operation.sourceDetail },
      });
      return;
    }
    case "researchSection": {
      if (initialResearchInFlight) return;
      const existingJob = await tx.sectionResearchJob.findUnique({
        where: { threadId_section: { threadId, section: operation.section } },
      });
      if (existingJob) return;
      await tx.sectionResearchJob.create({ data: { threadId, section: operation.section } });
      return operation.section;
    }
  }
}
