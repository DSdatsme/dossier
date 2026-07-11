import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatBar } from "./ChatBar";

describe("ChatBar", () => {
  it("starts collapsed and expands when the toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ChatBar messages={[{ id: "1", from: "assistant", text: "Hi" }]} />);

    const bar = screen.getByText("Hi").closest("[data-open]");
    expect(bar).toHaveAttribute("data-open", "false");

    await user.click(screen.getByRole("button", { name: "Expand chat" }));
    expect(bar).toHaveAttribute("data-open", "true");
  });

  it("renders each message attributed to its sender", () => {
    render(
      <ChatBar
        messages={[
          { id: "1", from: "you", text: "Round B went well" },
          { id: "2", from: "assistant", text: "Got it" },
        ]}
      />
    );
    expect(screen.getByText("Round B went well")).toBeInTheDocument();
    expect(screen.getByText("Got it")).toBeInTheDocument();
  });

  it("disables the input since chat is not wired up yet", () => {
    render(<ChatBar messages={[]} />);
    expect(screen.getByLabelText("Message")).toBeDisabled();
  });
});
