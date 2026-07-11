import { notFound } from "next/navigation";
import { getThreadReport, getThreadSummaries } from "@/lib/reports";
import { AppShell } from "@/components/AppShell";
import { ThreadRail } from "@/components/ThreadRail";
import { OverviewCard } from "@/components/OverviewCard";
import { RoundsCard } from "@/components/RoundsCard";
import { ChatBar } from "@/components/ChatBar";
import styles from "./page.module.css";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, threads] = await Promise.all([getThreadReport(id), getThreadSummaries()]);

  if (!report) notFound();

  return (
    <AppShell rail={<ThreadRail threads={threads} />}>
      <header className={styles.header}>
        <h1>
          {report.companyName} · {report.position}
        </h1>
        <span className={styles.sub}>{report.location}</span>
      </header>
      <OverviewCard sections={report.sections} companyDomain={report.companyDomain} />
      <RoundsCard
        rounds={report.rounds}
        confirmedTotalRounds={report.confirmedTotalRounds}
        confirmedTotalRoundsSource={report.confirmedTotalRoundsSource}
      />
      <ChatBar messages={[]} />
    </AppShell>
  );
}
