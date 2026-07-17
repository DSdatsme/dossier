import { prisma } from "./db";
import type { FactView, InterviewerView, RoundView, ThreadReport, ThreadSummary } from "./types";

function toFactView(fact: { id: string; content: string; sourceType: string; sourceDetail: string }): FactView {
  return {
    id: fact.id,
    content: fact.content,
    sourceType: fact.sourceType as FactView["sourceType"],
    sourceDetail: fact.sourceDetail,
  };
}

export async function getThreadSummaries(): Promise<ThreadSummary[]> {
  const threads = await prisma.thread.findMany({
    include: {
      rounds: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return threads
    .map((thread) => ({
      id: thread.id,
      companyName: thread.companyName,
      position: thread.position,
      location: thread.location,
      completedRounds: thread.rounds.filter((r) => r.status === "COMPLETED").length,
      totalRounds: thread.confirmedTotalRounds,
      hasNotHappeningRound: thread.rounds.some((r) => r.status === "NOT_HAPPENING"),
      lastActivityAt: thread.messages[0]?.createdAt ?? thread.createdAt,
    }))
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
    .map(({ lastActivityAt, ...summary }) => summary);
}

export async function getThreadReport(threadId: string): Promise<ThreadReport | null> {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      facts: { where: { roundId: null, state: "ACTIVE" } },
      rounds: {
        orderBy: { order: "asc" },
        include: {
          facts: { where: { state: "ACTIVE" } },
          interviewerLinks: { include: { profile: true } },
        },
      },
    },
  });

  if (!thread) return null;

  const sections: Record<string, FactView[]> = {};
  for (const fact of thread.facts) {
    (sections[fact.section] ??= []).push(toFactView(fact));
  }

  const rounds: RoundView[] = thread.rounds.map((round) => {
    const bySection: Record<string, FactView[]> = {};
    for (const fact of round.facts) {
      (bySection[fact.section] ??= []).push(toFactView(fact));
    }
    const interviewers: InterviewerView[] = round.interviewerLinks.map((link) => ({
      id: link.profile.id,
      name: link.profile.name,
      role: link.profile.role,
      tenure: link.profile.tenure,
      background: link.profile.background,
    }));

    return {
      id: round.id,
      name: round.name,
      order: round.order,
      status: round.status,
      prepMaterial: bySection["prepMaterial"] ?? [],
      smartQuestions: bySection["smartQuestions"] ?? [],
      yourNotes: bySection["yourNotes"] ?? [],
      interviewers,
    };
  });

  return {
    id: thread.id,
    companyName: thread.companyName,
    position: thread.position,
    location: thread.location,
    companyDomain: thread.companyDomain,
    confirmedTotalRounds: thread.confirmedTotalRounds,
    confirmedTotalRoundsSource: thread.confirmedTotalRoundsSource,
    researchStatus: thread.researchStatus,
    researchError: thread.researchError,
    sections,
    rounds,
  };
}
