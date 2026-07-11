"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadSummary } from "@/lib/types";
import styles from "./ThreadRail.module.css";

function progressLabel(thread: ThreadSummary): string {
  if (thread.hasNotHappeningRound) return "skipped";
  if (thread.totalRounds != null) return `${thread.completedRounds}/${thread.totalRounds}`;
  return `${thread.completedRounds}/—`;
}

export function ThreadRail({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();

  return (
    <div className={styles.railInner}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.word}>Research</span>
      </div>
      <Link href="/new" className={styles.newThread}>
        + New thread
      </Link>
      <nav className={styles.list} aria-label="Threads">
        {threads.map((thread) => {
          const href = `/thread/${thread.id}`;
          const active = pathname === href;

          return (
            <Link
              key={thread.id}
              href={href}
              className={active ? `${styles.thread} ${styles.threadActive}` : styles.thread}
            >
              <span className={styles.threadName}>{thread.companyName}</span>
              <span className={styles.threadMeta}>
                <span>
                  {thread.position} · {thread.location}
                </span>
                <span className={`${styles.progress} tabular`}>{progressLabel(thread)}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
