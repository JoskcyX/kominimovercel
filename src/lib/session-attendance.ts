import type { AttendanceRow } from "./attendance";

export type SessionTiming = { started_at: string; ended_at: string | null; attendance_threshold: number };
export type SessionParticipant = { name: string; identifier: string; present_seconds: number; joined_at: string; last_seen_at: string | null; left_at: string | null };

export function sessionAttendanceRows(session: SessionTiming, participants: SessionParticipant[], now = Date.now()): AttendanceRow[] {
  const seconds = Math.max(1, (new Date(session.ended_at ?? now).getTime() - new Date(session.started_at).getTime()) / 1000);
  const unique = new Map<string, SessionParticipant>();
  for (const participant of participants) {
    const key = participant.identifier.toLowerCase().replace(/[^a-z0-9]/g, "") || participant.name.trim().toLowerCase();
    const previous = unique.get(key);
    if (!previous || participant.present_seconds > previous.present_seconds) unique.set(key, participant);
  }
  return [...unique.values()].map((p) => {
    const percent = Math.min(100, Math.round(p.present_seconds / seconds * 100));
    return { name: p.name, identifier: p.identifier, minutes: Math.round(p.present_seconds / 60), percent,
      status: p.present_seconds / seconds * 100 >= session.attendance_threshold ? "Attended" : "Joined only",
      joinedAt: p.joined_at, lastSeenAt: p.last_seen_at, leftAt: p.left_at };
  });
}