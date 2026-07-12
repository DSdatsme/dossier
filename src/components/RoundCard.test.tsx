import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundCard } from "./RoundCard";
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

const fact = (content: string) => ({ id: content, content, sourceType: "RESEARCHED" as const, sourceDetail: "test" });

describe("RoundCard", () => {
  it("shows the round order, name, and status", () => {
    render(<RoundCard round={makeRound({ id: "a", name: "Technical", order: 2, status: "COMPLETED" })} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders prep material and smart questions when present", () => {
    render(
      <RoundCard
        round={makeRound({
          id: "a",
          prepMaterial: [fact("Review the system design doc")],
          smartQuestions: [fact("How is on-call structured?")],
        })}
      />
    );

    expect(screen.getByText("Review the system design doc")).toBeInTheDocument();
    expect(screen.getByText("How is on-call structured?")).toBeInTheDocument();
  });

  it("shows empty-state messages when a round has no data yet", () => {
    render(<RoundCard round={makeRound({ id: "a" })} />);

    expect(screen.getAllByText("Nothing specific found yet.")).toHaveLength(3);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });

  it("renders interviewer name, role/tenure, and background", () => {
    render(
      <RoundCard
        round={makeRound({
          id: "a",
          interviewers: [
            { id: "i1", name: "Jordan Lee", role: "Staff Engineer", tenure: "4 years", background: "Worked on payments infra" },
          ],
        })}
      />
    );

    expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer · 4 years")).toBeInTheDocument();
    expect(screen.getByText("Worked on payments infra")).toBeInTheDocument();
  });
});
