"use client";

import { useState } from "react";
import { deleteThreadAction } from "@/app/actions";
import styles from "./DeleteThreadButton.module.css";

export function DeleteThreadButton({ threadId }: { threadId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={styles.confirmRow}>
        <span className={styles.confirmLabel}>Delete forever?</span>
        <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
          Cancel
        </button>
        <form action={deleteThreadAction}>
          <input type="hidden" name="threadId" value={threadId} />
          <button type="submit" className={styles.confirmDelete}>
            Yes, delete
          </button>
        </form>
      </div>
    );
  }

  return (
    <button type="button" className={styles.button} onClick={() => setConfirming(true)}>
      Delete thread
    </button>
  );
}
