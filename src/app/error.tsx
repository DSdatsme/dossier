"use client";

import { useEffect } from "react";
import styles from "./state.module.css";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.message}>An unexpected error stopped this page from loading.</p>
        {error.message ? <code className={styles.detail}>{error.message}</code> : null}
        <button type="button" className={styles.action} onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
