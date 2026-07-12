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
        <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="dossierMark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#eef0fb" />
              <stop offset="1" stopColor="#c3cbec" />
            </linearGradient>
          </defs>
          <g transform="rotate(-7 12 11.5)">
            <path
              d="M6 4 L18 4 L18 16.8 L16.6 18.3 L15.1 17 L13.6 18.6 L12.1 17.1 L10.6 18.7 L9.1 17.2 L7.6 18.5 L6 17 Z"
              fill="url(#dossierMark)"
            />
            <line x1="8.3" y1="8.5" x2="15.7" y2="8.5" stroke="#5a6ba0" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
            <line x1="8.3" y1="11" x2="14.2" y2="11" stroke="#5a6ba0" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
          </g>
          <ellipse cx="12.6" cy="4.6" rx="1.9" ry="1.5" fill="#000" opacity="0.18" />
          <circle cx="12.3" cy="4.1" r="1.7" fill="#e0654a" />
          <circle cx="12.3" cy="4.1" r="0.6" fill="#a13d28" />
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
