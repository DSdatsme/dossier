import Link from "next/link";
import styles from "./state.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Thread not found</h1>
        <p className={styles.message}>This thread doesn&apos;t exist, or it may have been deleted.</p>
        <Link href="/" className={styles.action}>
          Back to Dossier
        </Link>
      </div>
    </div>
  );
}
