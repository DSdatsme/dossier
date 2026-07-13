import { describe, it, expect } from "vitest";
import { register } from "./instrumentation";
import { prisma } from "./lib/db";
import { deleteThread } from "./lib/threads";

describe("register", () => {
  it("marks any thread left RESEARCHING as FAILED, since a fresh boot means no in-flight research survived", async () => {
    const thread = await prisma.thread.create({
      data: { companyName: "Orphaned Co", position: "Engineer", location: "Remote", researchStatus: "RESEARCHING" },
    });

    await register();

    const updated = await prisma.thread.findUniqueOrThrow({ where: { id: thread.id } });
    expect(updated.researchStatus).toBe("FAILED");
    expect(updated.researchError).toContain("restart");

    await deleteThread(thread.id);
  });

  it("leaves DONE, FAILED, and NOT_STARTED threads untouched", async () => {
    const done = await prisma.thread.create({
      data: { companyName: "Fine Co", position: "Engineer", location: "Remote", researchStatus: "DONE" },
    });
    const alreadyFailed = await prisma.thread.create({
      data: {
        companyName: "Already Failed Co",
        position: "Engineer",
        location: "Remote",
        researchStatus: "FAILED",
        researchError: "some earlier reason",
      },
    });

    await register();

    const updatedDone = await prisma.thread.findUniqueOrThrow({ where: { id: done.id } });
    const updatedFailed = await prisma.thread.findUniqueOrThrow({ where: { id: alreadyFailed.id } });
    expect(updatedDone.researchStatus).toBe("DONE");
    expect(updatedFailed.researchStatus).toBe("FAILED");
    expect(updatedFailed.researchError).toBe("some earlier reason");

    await deleteThread(done.id);
    await deleteThread(alreadyFailed.id);
  });

  it("marks any message left PENDING as FAILED, since a fresh boot means no in-flight reply survived", async () => {
    const thread = await prisma.thread.create({
      data: { companyName: "Pending Chat Co", position: "Engineer", location: "Remote" },
    });
    const message = await prisma.message.create({
      data: { threadId: thread.id, role: "ASSISTANT", text: "", status: "PENDING" },
    });

    await register();

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(updated.status).toBe("FAILED");
    expect(updated.text).toContain("restart");

    await deleteThread(thread.id);
  });

  it("leaves DONE and FAILED messages untouched", async () => {
    const thread = await prisma.thread.create({
      data: { companyName: "Fine Chat Co", position: "Engineer", location: "Remote" },
    });
    const done = await prisma.message.create({
      data: { threadId: thread.id, role: "ASSISTANT", text: "All good.", status: "DONE" },
    });
    const alreadyFailed = await prisma.message.create({
      data: { threadId: thread.id, role: "ASSISTANT", text: "some earlier reason", status: "FAILED" },
    });

    await register();

    const updatedDone = await prisma.message.findUniqueOrThrow({ where: { id: done.id } });
    const updatedFailed = await prisma.message.findUniqueOrThrow({ where: { id: alreadyFailed.id } });
    expect(updatedDone.status).toBe("DONE");
    expect(updatedDone.text).toBe("All good.");
    expect(updatedFailed.status).toBe("FAILED");
    expect(updatedFailed.text).toBe("some earlier reason");

    await deleteThread(thread.id);
  });
});
