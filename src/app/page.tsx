import { redirect } from "next/navigation";
import { getThreadSummaries } from "@/lib/reports";

// This page's whole job is to redirect based on live DB state (which thread,
// if any, exists right now) — it must never be frozen as static build output,
// or a fresh deploy would always show build-time state instead of runtime data.
export const dynamic = "force-dynamic";

export default async function Home() {
  const threads = await getThreadSummaries();
  if (threads.length > 0) {
    redirect(`/thread/${threads[0].id}`);
  }
  return <p>No research yet.</p>;
}
