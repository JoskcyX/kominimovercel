import { describe, expect, it } from "vitest";
import { isRecentlyPresent, withinReconnectGrace } from "./live-connection";

describe("live interruption grace", () => {
  it("preserves presence during an interruption shorter than two minutes", () => {
    expect(withinReconnectGrace(1000, 120999)).toBe(true);
    expect(withinReconnectGrace(1000, 121000)).toBe(false);
  });
  it("ends presence immediately after an explicit departure", () => {
    expect(isRecentlyPresent("2026-11-04T06:00:00Z", "2026-11-04T06:00:01Z", Date.parse("2026-11-04T06:00:02Z"))).toBe(false);
  });
});