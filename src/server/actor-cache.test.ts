import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetActor, getCachedActor, setCachedActor } from "./actor-cache";

const actor = {
  userId: "u1",
  email: "a@b.dev",
  displayName: "A",
  plan: "free" as const,
  status: "active" as const,
  roles: [] as string[],
  referralCode: null,
  legalOk: true,
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("actor cache", () => {
  it("serves a recent profile and expires it after ~15 s", () => {
    setCachedActor("u1", actor);
    expect(getCachedActor("u1")?.plan).toBe("free");
    vi.advanceTimersByTime(14_000);
    expect(getCachedActor("u1")).toBeDefined();
    vi.advanceTimersByTime(2_000);
    expect(getCachedActor("u1")).toBeUndefined();
  });
  it("can be dropped immediately (legal acceptance, suspension, plan change)", () => {
    setCachedActor("u2", actor);
    forgetActor("u2");
    expect(getCachedActor("u2")).toBeUndefined();
  });
  it("never mixes users up", () => {
    setCachedActor("a", { ...actor, userId: "a", roles: ["admin"] });
    expect(getCachedActor("b")).toBeUndefined();
  });
});
