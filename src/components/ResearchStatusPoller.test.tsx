import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ResearchStatusPoller } from "./ResearchStatusPoller";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResearchStatusPoller", () => {
  it("calls router.refresh on an interval while active", () => {
    render(<ResearchStatusPoller active intervalMs={1000} />);

    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("does not poll when inactive", () => {
    render(<ResearchStatusPoller active={false} intervalMs={1000} />);

    vi.advanceTimersByTime(5000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
