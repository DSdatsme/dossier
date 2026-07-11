import { prisma } from "./db";

export interface CreateThreadInput {
  companyName: string;
  companyDomain?: string;
  position: string;
  location: string;
}

export async function createThread(input: CreateThreadInput): Promise<string> {
  const thread = await prisma.thread.create({
    data: {
      companyName: input.companyName,
      companyDomain: input.companyDomain ?? null,
      position: input.position,
      location: input.location,
    },
  });
  return thread.id;
}

export async function deleteThread(threadId: string): Promise<void> {
  await prisma.fact.deleteMany({ where: { threadId } });
  await prisma.roundInterviewer.deleteMany({ where: { round: { threadId } } });
  await prisma.interviewerProfile.deleteMany({ where: { threadId } });
  await prisma.round.deleteMany({ where: { threadId } });
  await prisma.thread.delete({ where: { id: threadId } });
}
