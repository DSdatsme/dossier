"use client";

import { retryResearchAction } from "@/app/actions";
import type { ResearchStatusView } from "@/lib/types";
import styles from "./ResearchStatusBanner.module.css";

export function ResearchStatusBanner({
  threadId,
  companyName,
  researchStatus,
  researchError,
}: {
  threadId: string;
  companyName: string;
  researchStatus: ResearchStatusView;
  researchError: string | null;
}) {
  if (researchStatus === "RESEARCHING") {
    return (
      <div className={styles.banner} data-status="researching">
        Researching {companyName}... this can take a minute.
      </div>
    );
  }

  if (researchStatus === "FAILED") {
    return (
      <div className={styles.banner} data-status="failed">
        <span>Research failed{researchError ? `: ${researchError}` : "."}</span>
        <form action={retryResearchAction}>
          <input type="hidden" name="threadId" value={threadId} />
          <button type="submit" className={styles.retry}>
            Retry research
          </button>
        </form>
      </div>
    );
  }

  return null;
}
