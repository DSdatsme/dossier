import { prisma } from "./db";
import { spawnClaudeCli, type CliRunner } from "./researchEngine";
import { buildChatPrompt } from "./chatPrompt";
import { parseChatResponse, type ChatOperation, type RoundStatusValue } from "./chatParsing";
import { getThreadReport } from "./reports";
import { getThreadMessages } from "./messages";

export interface ChatEngine {
  respond(threadId: string, assistantMessageId: string): Promise<void>;
}

const MAX_HISTORY_MESSAGES = 20;

export class ClaudeCodeCliChatEngine implements ChatEngine {
  constructor(private runner: CliRunner = spawnClaudeCli) {}

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

      try {
        await applyOperations(threadId, parsed.operations);
      } catch (error) {
        await markFailed(assistantMessageId, describeError(error));
        return;
      }

      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { text: parsed.reply, status: "DONE" },
      });
      console.log(`[chat] thread ${threadId}: applied ${parsed.operations.length} operation(s), marked DONE`);
    } catch (error) {
      await markFailed(assistantMessageId, describeError(error)).catch(() => {
        console.error(`[chat] message ${assistantMessageId}: failed to record failure too (thread likely gone)`);
      });
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

async function applyOperations(threadId: string, operations: ChatOperation[]): Promise<void> {
  if (operations.length === 0) return;

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
      await applyOneOperation(tx, threadId, operation, resolveRoundRef, registerRound, () => {
        maxOrder += 1;
        return maxOrder;
      });
    }
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function applyOneOperation(
  tx: Tx,
  threadId: string,
  operation: ChatOperation,
  resolveRoundRef: (ref: string) => string,
  registerRound: (id: string, name: string) => void,
  nextOrder: () => number
): Promise<void> {
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
      return;
    }
    case "setConfirmedTotalRounds": {
      await tx.thread.update({
        where: { id: threadId },
        data: { confirmedTotalRounds: operation.count, confirmedTotalRoundsSource: operation.sourceDetail },
      });
      return;
    }
  }
}
