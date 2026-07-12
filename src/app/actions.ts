"use server";

import { redirect } from "next/navigation";
import { createThread, deleteThread } from "@/lib/threads";
import { getThreadSummaries } from "@/lib/reports";
import { prisma } from "@/lib/db";
import { ClaudeCodeCliResearchEngine } from "@/lib/researchEngine";

const researchEngine = new ClaudeCodeCliResearchEngine();

export async function createThreadAction(formData: FormData) {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const companyDomain = String(formData.get("companyDomain") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!companyName || !position || !location) {
    throw new Error("Company name, position, and location are required.");
  }

  const id = await createThread({
    companyName,
    companyDomain: companyDomain || undefined,
    position,
    location,
  });

  await prisma.thread.update({ where: { id }, data: { researchStatus: "RESEARCHING" } });
  void researchEngine.research({
    threadId: id,
    companyName,
    companyDomain: companyDomain || null,
    position,
    location,
  });

  redirect(`/thread/${id}`);
}

export async function retryResearchAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) {
    throw new Error("Missing thread id.");
  }

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) {
    throw new Error("Thread not found.");
  }

  await prisma.thread.update({
    where: { id: threadId },
    data: { researchStatus: "RESEARCHING", researchError: null },
  });
  void researchEngine.research({
    threadId,
    companyName: thread.companyName,
    companyDomain: thread.companyDomain,
    position: thread.position,
    location: thread.location,
  });

  redirect(`/thread/${threadId}`);
}

export async function deleteThreadAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) {
    throw new Error("Missing thread id.");
  }

  await deleteThread(threadId);

  const remaining = await getThreadSummaries();
  if (remaining.length > 0) {
    redirect(`/thread/${remaining[0].id}`);
  }
  redirect("/");
}
