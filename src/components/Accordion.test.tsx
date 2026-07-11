import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "./Accordion";

describe("Accordion", () => {
  it("is collapsed by default and expands on click", async () => {
    const user = userEvent.setup();
    render(<Accordion title="Overview">body content</Accordion>);

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("honors defaultOpen", () => {
    render(
      <Accordion title="Overview" defaultOpen>
        body content
      </Accordion>
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders an optional highlight next to the title", () => {
    render(
      <Accordion title="Rounds" highlight="2 of 4 completed">
        body content
      </Accordion>
    );
    expect(screen.getByText("2 of 4 completed")).toBeInTheDocument();
  });

  it("does not force a nested Accordion open just because the outer one is open", () => {
    render(
      <Accordion title="Rounds" defaultOpen>
        <Accordion title="Round A">inner body</Accordion>
      </Accordion>
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
  });
});
