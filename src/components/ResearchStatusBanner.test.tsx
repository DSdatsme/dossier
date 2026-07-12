import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchStatusBanner } from "./ResearchStatusBanner";

describe("ResearchStatusBanner", () => {
  it("shows a researching message when in progress", () => {
    render(
      <ResearchStatusBanner threadId="t1" companyName="Acme" researchStatus="RESEARCHING" researchError={null} />
    );
    expect(screen.getByText("Researching Acme... this can take a minute.")).toBeInTheDocument();
  });

  it("shows the error and a retry button when failed", () => {
    render(
      <ResearchStatusBanner threadId="t1" companyName="Acme" researchStatus="FAILED" researchError="timed out" />
    );
    expect(screen.getByText("Research failed: timed out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry research" })).toBeInTheDocument();
  });

  it("renders nothing when done", () => {
    const { container } = render(
      <ResearchStatusBanner threadId="t1" companyName="Acme" researchStatus="DONE" researchError={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when not started", () => {
    const { container } = render(
      <ResearchStatusBanner threadId="t1" companyName="Acme" researchStatus="NOT_STARTED" researchError={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
