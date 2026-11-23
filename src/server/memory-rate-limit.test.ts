import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertMemoryRate, memoryRateLimit } from "./memory-rate-limit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("memoryRateLimit", () => {
  it("allows up to max, then blocks, per key", () => {
    const k = `t-${Math.random()}`;
    expect([1, 2, 3, 4].map(() => memoryRateLimit(k, 60, 3))).toEqual([true, true, true, false]);
    expect(memoryRateLimit(`${k}-other`, 60, 3)).toBe(true); // other keys unaffected
  });
  it("opens a fresh window after the time passes", () => {
    const k = `t-${Math.random()}`;
    for (let i = 0; i < 5; i++) memoryRateLimit(k, 10, 2);
    expect(memoryRateLimit(k, 10, 2)).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(memoryRateLimit(k, 10, 2)).toBe(true);
  });
  it("assertMemoryRate throws a friendly RATE_LIMITED error", () => {
    const k = `t-${Math.random()}`;
    assertMemoryRate(k, 60, 1);
    expect(() => assertMemoryRate(k, 60, 1, "Slow down")).toThrow("Slow down");
  });
});
