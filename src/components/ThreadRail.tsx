"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadSummary } from "@/lib/types";
import styles from "./ThreadRail.module.css";

function progressLabel(thread: ThreadSummary): string {
  const fraction = thread.totalRounds != null ? `${thread.completedRounds}/${thread.totalRounds}` : `${thread.completedRounds}/—`;
  return thread.hasNotHappeningRound ? `${fraction} · skipped` : fraction;
}

export function ThreadRail({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();

  return (
    <div className={styles.railInner}>
      <div className={styles.brand}>
        <svg className={styles.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="dossierMark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#93a3d6" />
              <stop offset="1" stopColor="#3b4a73" />
            </linearGradient>
          </defs>
          <path d="M3 6h6v2h12v11H3V6z" fill="url(#dossierMark)" />
        </svg>
        <span className={styles.word}>Dossier</span>
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
