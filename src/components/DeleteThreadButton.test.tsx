import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteThreadButton } from "./DeleteThreadButton";

describe("DeleteThreadButton", () => {
  it("shows a confirmation step before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteThreadButton threadId="t1" />);

    expect(screen.queryByText("Delete forever?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete thread" }));

    expect(screen.getByText("Delete forever?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("cancels back to the initial button without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteThreadButton threadId="t1" />);

    await user.click(screen.getByRole("button", { name: "Delete thread" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete thread" })).toBeInTheDocument();
    expect(screen.queryByText("Delete forever?")).not.toBeInTheDocument();
  });

  it("submits the threadId as a hidden field when confirmed", async () => {
    const user = userEvent.setup();
    render(<DeleteThreadButton threadId="thread-123" />);

    await user.click(screen.getByRole("button", { name: "Delete thread" }));

    const hiddenInput = document.querySelector('input[name="threadId"]') as HTMLInputElement;
    expect(hiddenInput.value).toBe("thread-123");
  });
});
