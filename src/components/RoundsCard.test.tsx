import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundsCard } from "./RoundsCard";
import type { RoundView } from "@/lib/types";

function makeRound(overrides: Partial<RoundView> & { id: string }): RoundView {
  return {
    name: "Round",
    order: 1,
    status: "UPCOMING",
    prepMaterial: [],
    smartQuestions: [],
    yourNotes: [],
    interviewers: [],
    ...overrides,
  };
}

describe("RoundsCard highlight", () => {
  it("shows a skipped-round message when any round is not-happening, even with a confirmed total", () => {
    const rounds = [
      makeRound({ id: "a", name: "HR", status: "COMPLETED" }),
      makeRound({ id: "b", name: "System Design", status: "NOT_HAPPENING" }),
    ];
    render(<RoundsCard rounds={rounds} confirmedTotalRounds={4} confirmedTotalRoundsSource="glassdoor" />);
    expect(screen.getByText("1 of 2 completed · System Design skipped")).toBeInTheDocument();
  });

  it("shows completed-of-total when a total is confirmed and nothing is skipped", () => {
    const rounds = [makeRound({ id: "a", status: "COMPLETED" }), makeRound({ id: "b", status: "COMPLETED" })];
    render(<RoundsCard rounds={rounds} confirmedTotalRounds={4} confirmedTotalRoundsSource="glassdoor" />);
    expect(screen.getByText("2 of 4 completed")).toBeInTheDocument();
  });

  it("falls back to a plain count, including zero, when no total is confirmed", () => {
    const rounds = [makeRound({ id: "a", status: "UPCOMING" })];
    render(<RoundsCard rounds={rounds} confirmedTotalRounds={null} confirmedTotalRoundsSource={null} />);
    expect(screen.getByText("0 rounds so far")).toBeInTheDocument();
  });

  it("renders every round card, with empty fields showing rather than being omitted", () => {
    const rounds = [makeRound({ id: "a", name: "HR Screening" }), makeRound({ id: "b", name: "Technical" })];
    render(<RoundsCard rounds={rounds} confirmedTotalRounds={null} confirmedTotalRoundsSource={null} />);
    expect(screen.getByText("HR Screening")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getAllByText("Nothing specific found yet.")).toHaveLength(6);
    expect(screen.getAllByText("Nothing yet.")).toHaveLength(2);
  });

  it("shows an empty-state message rather than a bare well when there are no rounds", () => {
    render(<RoundsCard rounds={[]} confirmedTotalRounds={null} confirmedTotalRoundsSource={null} />);
    expect(screen.getByText("No rounds confirmed yet.")).toBeInTheDocument();
  });
});
