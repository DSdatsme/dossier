import { Accordion } from "./Accordion";
import type { RoundView } from "@/lib/types";
import styles from "./RoundCard.module.css";

const STATUS_LABEL: Record<RoundView["status"], string> = {
  UPCOMING: "upcoming",
  COMPLETED: "completed",
  NOT_HAPPENING: "not-happening",
};

export function RoundCard({ round }: { round: RoundView }) {
  const title = (
    <span className={styles.headContent}>
      <span className={`${styles.order} tabular`}>{round.order}</span>
      <span className={styles.name}>{round.name}</span>
      <span className={styles.status} data-status={round.status}>
        {STATUS_LABEL[round.status]}
      </span>
    </span>
  );

  return (
    <Accordion title={title}>
      <div className={styles.field}>
        <h4>Prep material</h4>
        {round.prepMaterial.length === 0 ? (
          <p className={styles.empty}>Nothing specific found yet.</p>
        ) : (
          <ul className={styles.list}>
            {round.prepMaterial.map((fact) => (
              <li key={fact.id}>{fact.content}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.field}>
        <h4>Interviewer Brief</h4>
        {round.interviewers.length === 0 ? (
          <p className={styles.empty}>Nothing specific found yet.</p>
        ) : (
          round.interviewers.map((interviewer) => (
            <div key={interviewer.id} className={styles.interviewer}>
              <span className={styles.interviewerName}>{interviewer.name}</span>
              <span className={styles.interviewerLine}>
                {[interviewer.role, interviewer.tenure].filter(Boolean).join(" · ")}
              </span>
              {interviewer.background ? <span className={styles.interviewerSub}>{interviewer.background}</span> : null}
            </div>
          ))
        )}
      </div>
      <div className={styles.field}>
        <h4>Smart Questions to Ask</h4>
        {round.smartQuestions.length === 0 ? (
          <p className={styles.empty}>Nothing specific found yet.</p>
        ) : (
          <ul className={styles.list}>
            {round.smartQuestions.map((fact) => (
              <li key={fact.id}>{fact.content}</li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.field}>
        <h4>Your Notes</h4>
        {round.yourNotes.length === 0 ? (
          <p className={styles.empty}>Nothing yet.</p>
        ) : (
          round.yourNotes.map((fact) => <p key={fact.id}>{fact.content}</p>)
        )}
      </div>
    </Accordion>
  );
}
