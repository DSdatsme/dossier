import { createThreadAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { ThreadRail } from "@/components/ThreadRail";
import { getThreadSummaries } from "@/lib/reports";
import styles from "./page.module.css";

export default async function NewThreadPage() {
  const threads = await getThreadSummaries();

  return (
    <AppShell rail={<ThreadRail threads={threads} />}>
      <h1 className={styles.title}>New thread</h1>
      <form action={createThreadAction} className={styles.form}>
        <label className={styles.field}>
          <span>Company name</span>
          <input name="companyName" required />
        </label>
        <label className={styles.field}>
          <span>Company domain (optional)</span>
          <input name="companyDomain" placeholder="example.com" />
        </label>
        <label className={styles.field}>
          <span>Position</span>
          <input name="position" required />
        </label>
        <label className={styles.field}>
          <span>Location</span>
          <input name="location" required />
        </label>
        <button type="submit" className={styles.submit}>
          Create thread
        </button>
      </form>
    </AppShell>
  );
}
