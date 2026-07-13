import { notFound } from "next/navigation";
import { getThreadReport, getThreadSummaries } from "@/lib/reports";
import { getThreadMessages } from "@/lib/messages";
import { AppShell } from "@/components/AppShell";
import { ThreadRail } from "@/components/ThreadRail";
import { OverviewCard } from "@/components/OverviewCard";
import { RoundsCard } from "@/components/RoundsCard";
import { ChatBar } from "@/components/ChatBar";
import { DeleteThreadButton } from "@/components/DeleteThreadButton";
import { ResearchStatusBanner } from "@/components/ResearchStatusBanner";
import { ResearchStatusPoller } from "@/components/ResearchStatusPoller";
import styles from "./page.module.css";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, threads, messages] = await Promise.all([
    getThreadReport(id),
    getThreadSummaries(),
    getThreadMessages(id),
  ]);

  if (!report) notFound();

  const hasPendingMessage = messages.some((message) => message.status === "PENDING");

  return (
    <AppShell rail={<ThreadRail threads={threads} />}>
      <div className={styles.headerRow}>
        <header className={styles.header}>
          <h1>
            {report.companyName} · {report.position}
          </h1>
          <span className={styles.sub}>{report.location}</span>
        </header>
        <DeleteThreadButton threadId={report.id} />
      </div>
      <ResearchStatusBanner
        threadId={report.id}
        companyName={report.companyName}
        researchStatus={report.researchStatus}
        researchError={report.researchError}
      />
      <ResearchStatusPoller active={report.researchStatus === "RESEARCHING" || hasPendingMessage} />
      <OverviewCard sections={report.sections} companyDomain={report.companyDomain} />
      <RoundsCard
        rounds={report.rounds}
        confirmedTotalRounds={report.confirmedTotalRounds}
        confirmedTotalRoundsSource={report.confirmedTotalRoundsSource}
      />
      <ChatBar threadId={report.id} messages={messages} />
    </AppShell>
  );
}
