import styles from "./state.module.css";

export default function Loading() {
  return (
    <div className={styles.wrap}>
      <p className={styles.message}>Loading…</p>
    </div>
  );
}
