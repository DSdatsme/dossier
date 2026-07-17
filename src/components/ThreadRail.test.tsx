import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThreadRail } from "./ThreadRail";
import type { ThreadSummary } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/thread/nimbus-id",
}));

const threads: ThreadSummary[] = [
  { id: "nimbus-id", companyName: "Nimbus Robotics", position: "Senior DevOps Engineer", location: "Austin, TX", completedRounds: 2, totalRounds: 4, hasNotHappeningRound: true },
  { id: "foo-id", companyName: "Foo Inc", position: "Platform Engineer", location: "Remote", completedRounds: 0, totalRounds: null, hasNotHappeningRound: false },
];

describe("ThreadRail", () => {
  it("renders every thread with a progress indicator", () => {
    render(<ThreadRail threads={threads} />);
    expect(screen.getByText("Nimbus Robotics")).toBeInTheDocument();
    expect(screen.getByText("Foo Inc")).toBeInTheDocument();
    expect(screen.getByText("2/4 · skipped")).toBeInTheDocument();
    expect(screen.getByText("0/?")).toBeInTheDocument();
  });

  it("marks the thread matching the current route as active", () => {
    render(<ThreadRail threads={threads} />);
    const nimbusLink = screen.getByText("Nimbus Robotics").closest("a");
    const fooLink = screen.getByText("Foo Inc").closest("a");
    expect(nimbusLink?.className).toMatch(/threadActive/);
    expect(fooLink?.className).not.toMatch(/threadActive/);
  });
});
