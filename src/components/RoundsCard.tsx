import { Accordion } from "./Accordion";
import { RoundCard } from "./RoundCard";
import type { RoundView } from "@/lib/types";
import styles from "./RoundsCard.module.css";

function highlightFor(
  rounds: RoundView[],
  confirmedTotalRounds: number | null
): string {
  const completed = rounds.filter((r) => r.status === "COMPLETED").length;
  const skipped = rounds.find((r) => r.status === "NOT_HAPPENING");

  if (skipped) {
    return `${skipped.name} skipped · ${completed} of ${rounds.length} completed`;
  }
  if (confirmedTotalRounds != null) {
    return `${completed} of ${confirmedTotalRounds} completed`;
  }
  return `${completed} round${completed === 1 ? "" : "s"} so far`;
}

export function RoundsCard({
  rounds,
  confirmedTotalRounds,
  confirmedTotalRoundsSource,
}: {
  rounds: RoundView[];
  confirmedTotalRounds: number | null;
  confirmedTotalRoundsSource: string | null;
}) {
  const highlight = highlightFor(rounds, confirmedTotalRounds);
  const title = confirmedTotalRoundsSource ? (
    <span title={confirmedTotalRoundsSource}>Rounds</span>
  ) : (
    "Rounds"
  );

  return (
    <Accordion title={title} highlight={highlight} defaultOpen>
      <div className={styles.well}>
        <div className={styles.list}>
          {rounds.map((round) => (
            <RoundCard key={round.id} round={round} />
          ))}
        </div>
      </div>
    </Accordion>
  );
}
