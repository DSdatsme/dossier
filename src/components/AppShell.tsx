import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export function AppShell({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.app}>
      <aside className={styles.rail}>{rail}</aside>
      <main className={styles.canvas}>{children}</main>
    </div>
  );
}
