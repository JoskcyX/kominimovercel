import { describe, expect, it } from "vitest";
import { buildAttendanceCsv } from "./attendance";

describe("attendance CSV", () => {
  it("includes the class date and each student's status", () => {
    const csv = buildAttendanceCsv({
      platform: "Kominimo", classTitle: "Bio, 101", subject: "", classCode: "ABC", classDate: new Date("2026-10-29T10:00:00"),
      idLabel: "Matric number", threshold: 75, sessionMinutes: 60,
      rows: [{ name: "Ada", identifier: "MAT/1", status: "Joined only", minutes: 2, percent: 3, joinedAt: null, lastSeenAt: null, leftAt: null }],
    });
    expect(csv).toContain('"Bio, 101"');
    expect(csv).toContain("2026");
    expect(csv).toContain("1,Ada,MAT/1,Joined only,2,3%");
  });
});
