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
        companyDomain="example.com"
        sections={{
          companySnapshot: [researched("Founded 2010.")],
          techStack: [researched("Go"), userProvided("Python — migrating off")],
        }}
      />
    );

    expect(screen.getByText("Founded 2010.")).toBeInTheDocument();
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

  it("renders a section heading without crashing when there is no data at all", () => {
    render(<OverviewCard companyDomain={null} sections={{}} />);
    expect(screen.getByText("Culture & Values")).toBeInTheDocument();
  });

  it("fills every fixed slot (stat-strip + the two key/value blocks) with a placeholder instead of hiding it when data is missing", () => {
    render(<OverviewCard companyDomain={null} sections={{}} />);
    // 4 stat-strip cells (Rating/Employees/Founded/HQ) + 3 Company @ Location rows + 3 Role Specifics rows
    expect(screen.getAllByText("—")).toHaveLength(10);
  });

  it("shows a Rating stat parsed from the Culture & Values section's Glassdoor fact", () => {
    render(
      <OverviewCard
        companyDomain={null}
        sections={{
          companySnapshot: [researched("Founded: 2016"), researched("Employees: ~600"), researched("HQ: Austin, TX")],
          cultureValues: [researched("Glassdoor: 4.0/5, 240 reviews")],
        }}
      />
    );

    expect(screen.getByText("4.0/5")).toBeInTheDocument();
    expect(screen.getByText("2016")).toBeInTheDocument();
    expect(screen.getByText("~600")).toBeInTheDocument();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  });

  it("fills fixed key/value rows (Company @ Location, Role Specifics) with a placeholder when a slot has no matching fact", () => {
    render(
      <OverviewCard
        companyDomain={null}
        sections={{ companyAtLocation: [researched("Office opened: 2019")] }}
      />
    );

    expect(screen.getByText("Office opened")).toBeInTheDocument();
    expect(screen.getByText("2019")).toBeInTheDocument();
    expect(screen.getByText("Local team")).toBeInTheDocument();
    expect(screen.getByText("Reports to")).toBeInTheDocument();
  });

  it("shows an empty-state message for variable-length sections (not the fixed slots) when there is no data", () => {
    render(<OverviewCard companyDomain={null} sections={{}} />);
    // Culture & Values, Funding & News, Tech Stack, Compensation, Red Flags, Sources
    expect(screen.getAllByText("Nothing specific found yet.")).toHaveLength(6);
  });
});
