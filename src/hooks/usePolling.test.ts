import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "./usePolling";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("polls repeatedly, with jittered (not identical) spacing", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(fn, 1000));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(13);
  });

  it("does nothing when the interval is null", async () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, null));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("stops while the tab is hidden and refreshes immediately when it returns", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling(fn, 1000));
    await vi.advanceTimersByTimeAsync(2500);
    setHidden(true);
    const before = fn.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fn.mock.calls.length).toBe(before); // silent in the background
    setHidden(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(fn.mock.calls.length).toBe(before + 1); // instant catch-up
  });

  it("backs off when the server is failing, then recovers", async () => {
    let failing = true;
    const fn = vi.fn().mockImplementation(async () => {
      if (failing) throw new Error("503");
    });
    renderHook(() => usePolling(fn, 1000));
    await vi.advanceTimersByTimeAsync(30_000);
    const whileFailing = fn.mock.calls.length;
    expect(whileFailing).toBeLessThan(12); // would be ~30 without backoff
    failing = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fn.mock.calls.length).toBeGreaterThan(whileFailing + 3);
  });

  it("cleans up on unmount", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePolling(fn, 1000));
    await vi.advanceTimersByTimeAsync(1500);
    unmount();
    const n = fn.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn.mock.calls.length).toBe(n);
  });
});
