import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the rail and main content in their own regions", () => {
    render(
      <AppShell rail={<nav>Rail content</nav>}>
        <p>Main content</p>
      </AppShell>
    );

    expect(screen.getByText("Rail content").closest("aside")).toBeInTheDocument();
    expect(screen.getByText("Main content").closest("main")).toBeInTheDocument();
  });
});
