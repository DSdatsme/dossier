import { prisma } from "./db";
import type { ChatMessage } from "./types";

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((message) => ({
    id: message.id,
    from: message.role === "USER" ? "you" : "assistant",
    text: message.text,
    status: message.status,
  }));
}
