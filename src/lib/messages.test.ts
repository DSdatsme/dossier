import { describe, it, expect } from "vitest";
import { getThreadMessages } from "./messages";
import { createThread, deleteThread } from "./threads";
import { prisma } from "./db";

describe("getThreadMessages", () => {
  it("returns an empty array for a thread with no messages", async () => {
    const threadId = await createThread({ companyName: "Quiet Co", position: "Engineer", location: "Remote" });

    expect(await getThreadMessages(threadId)).toEqual([]);

    await deleteThread(threadId);
  });

  it("maps role to `from` and orders messages oldest first", async () => {
    const threadId = await createThread({ companyName: "Chatty Co", position: "Engineer", location: "Remote" });
    await prisma.message.create({ data: { threadId, role: "USER", text: "First", status: "DONE" } });
    await prisma.message.create({ data: { threadId, role: "ASSISTANT", text: "Second", status: "DONE" } });
    await prisma.message.create({ data: { threadId, role: "ASSISTANT", text: "", status: "PENDING" } });

    const messages = await getThreadMessages(threadId);

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({ from: "you", text: "First", status: "DONE" });
    expect(messages[1]).toMatchObject({ from: "assistant", text: "Second", status: "DONE" });
    expect(messages[2]).toMatchObject({ from: "assistant", text: "", status: "PENDING" });

    await deleteThread(threadId);
  });

  it("does not return messages from other threads", async () => {
    const threadA = await createThread({ companyName: "Thread A Co", position: "Engineer", location: "Remote" });
    const threadB = await createThread({ companyName: "Thread B Co", position: "Engineer", location: "Remote" });
    await prisma.message.create({ data: { threadId: threadA, role: "USER", text: "For A only", status: "DONE" } });

    const messagesForB = await getThreadMessages(threadB);

    expect(messagesForB).toEqual([]);

    await deleteThread(threadA);
    await deleteThread(threadB);
  });
});
