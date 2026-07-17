import styles from "./ChatStatusBanner.module.css";

export function ChatStatusBanner({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      Assistant is thinking about your last message...
    </div>
  );
}
