import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatBar } from "./ChatBar";
import { sendChatMessageAction } from "@/app/actions";

vi.mock("@/app/actions", () => ({
  sendChatMessageAction: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(sendChatMessageAction).mockClear();
});

describe("ChatBar", () => {
  it("starts collapsed and expands when the toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ChatBar threadId="t1" messages={[{ id: "1", from: "assistant", text: "Hi", status: "DONE" }]} />);

    const bar = screen.getByText("Hi").closest("[data-open]");
    expect(bar).toHaveAttribute("data-open", "false");

    await user.click(screen.getByRole("button", { name: "Expand chat" }));
    expect(bar).toHaveAttribute("data-open", "true");
  });

  it("renders each message attributed to its sender", () => {
    render(
      <ChatBar
        threadId="t1"
        messages={[
          { id: "1", from: "you", text: "Round B went well", status: "DONE" },
          { id: "2", from: "assistant", text: "Got it", status: "DONE" },
        ]}
      />
    );
    expect(screen.getByText("Round B went well")).toBeInTheDocument();
    expect(screen.getByText("Got it")).toBeInTheDocument();
  });

  it("shows a thinking indicator for a pending assistant reply instead of its (empty) text", () => {
    render(<ChatBar threadId="t1" messages={[{ id: "1", from: "assistant", text: "", status: "PENDING" }]} />);
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("shows a failed assistant reply's error text", () => {
    render(
      <ChatBar threadId="t1" messages={[{ id: "1", from: "assistant", text: "Sorry, that didn't work.", status: "FAILED" }]} />
    );
    expect(screen.getByText("Sorry, that didn't work.")).toBeInTheDocument();
  });

  it("enables the input when nothing is pending", () => {
    render(<ChatBar threadId="t1" messages={[]} />);
    expect(screen.getByLabelText("Message")).not.toBeDisabled();
  });

  it("disables the input and send button while a reply is pending", () => {
    render(<ChatBar threadId="t1" messages={[{ id: "1", from: "assistant", text: "", status: "PENDING" }]} />);
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the trimmed message and clears the input", async () => {
    const user = userEvent.setup();
    render(<ChatBar threadId="thread-123" messages={[]} />);

    const input = screen.getByLabelText("Message");
    await user.type(input, "  Phone screen went well  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendChatMessageAction).toHaveBeenCalledWith("thread-123", "Phone screen went well");
    expect(input).toHaveValue("");
  });

  it("does not send an empty or whitespace-only message", async () => {
    const user = userEvent.setup();
    render(<ChatBar threadId="t1" messages={[]} />);

    await user.type(screen.getByLabelText("Message"), "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(sendChatMessageAction).not.toHaveBeenCalled();
  });
});
