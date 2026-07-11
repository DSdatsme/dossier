import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewCard } from "./OverviewCard";
import type { FactView } from "@/lib/types";

const researched = (content: string): FactView => ({ id: content, content, sourceType: "RESEARCHED", sourceDetail: "test" });
const userProvided = (content: string): FactView => ({ id: content, content, sourceType: "USER_PROVIDED", sourceDetail: "your notes" });

describe("OverviewCard", () => {
  it("renders each section's facts", () => {
    render(
      <OverviewCard
        companyDomain="omp.com"
        sections={{
          companySnapshot: [researched("Founded 1985.")],
          techStack: [researched("Go"), userProvided("Python — migrating off")],
        }}
      />
    );

    expect(screen.getByText("Founded 1985.")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.getByText("Python — migrating off")).toBeInTheDocument();
  });

  it("tags user-provided facts distinctly from researched ones", () => {
    render(
      <OverviewCard
        companyDomain={null}
        sections={{ techStack: [researched("Go"), userProvided("Python — migrating off")] }}
      />
    );

    expect(screen.getByText("Go").closest("li")).toHaveAttribute("data-source", "RESEARCHED");
    expect(screen.getByText("Python — migrating off").closest("li")).toHaveAttribute("data-source", "USER_PROVIDED");
  });

  it("starts expanded", () => {
    render(<OverviewCard companyDomain={null} sections={{}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders an empty section without crashing", () => {
    render(<OverviewCard companyDomain={null} sections={{}} />);
    expect(screen.getByText("Company Snapshot")).toBeInTheDocument();
  });
});
