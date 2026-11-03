import { describe, expect, it } from "vitest";
import { sessionAttendanceRows } from "./session-attendance";

describe("separate live session attendance", () => {
  const participant = { name: "Ada", identifier: "MAT/1", present_seconds: 2700, joined_at: "2026-11-03T10:00:00Z", last_seen_at: null, left_at: null };
  const session = { started_at: "2026-11-03T10:00:00Z", ended_at: "2026-11-03T11:00:00Z", attendance_threshold: 75 };
  it("retains a finished day's attendance regardless of today's time", () => {
    expect(sessionAttendanceRows(session, [participant], Date.parse("2026-12-01T12:00:00Z"))[0]).toMatchObject({ percent: 75, status: "Attended" });
  });
  it("keeps someone who left immediately as joined only", () => {
    expect(sessionAttendanceRows(session, [{ ...participant, present_seconds: 1 }])[0]?.status).toBe("Joined only");
  });
  it("does not carry participants into another session", () => {
    expect(sessionAttendanceRows({ ...session, started_at: "2026-11-04T10:00:00Z", ended_at: "2026-11-04T11:00:00Z" }, [])).toEqual([]);
  });
});