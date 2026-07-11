import { redirect } from "next/navigation";
import { getThreadSummaries } from "@/lib/reports";

export default async function Home() {
  const threads = await getThreadSummaries();
  if (threads.length > 0) {
    redirect(`/thread/${threads[0].id}`);
  }
  return <p>No research yet.</p>;
}
