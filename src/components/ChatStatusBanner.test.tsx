import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatStatusBanner } from "./ChatStatusBanner";

describe("ChatStatusBanner", () => {
  it("shows a thinking message when active", () => {
    render(<ChatStatusBanner active />);
    expect(screen.getByText("Assistant is thinking about your last message...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders nothing when not active", () => {
    const { container } = render(<ChatStatusBanner active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
