export async function register() {
  const { prisma } = await import("@/lib/db");

  const { count } = await prisma.thread.updateMany({
    where: { researchStatus: "RESEARCHING" },
    data: {
      researchStatus: "FAILED",
      researchError: "Research was interrupted by a server restart — click Retry to run it again.",
    },
  });

  if (count > 0) {
    console.log(`[research] recovered ${count} thread(s) orphaned by a server restart`);
  }

  const { count: messageCount } = await prisma.message.updateMany({
    where: { status: "PENDING" },
    data: {
      status: "FAILED",
      text: "This reply was interrupted by a server restart — try sending your message again.",
    },
  });

  if (messageCount > 0) {
    console.log(`[chat] recovered ${messageCount} message(s) orphaned by a server restart`);
  }
}
