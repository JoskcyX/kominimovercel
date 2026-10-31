import { describe, expect, it } from "vitest";
import { questionSecondsLeft, shouldAdvanceQuestion, type QuizClock } from "./quiz-timer";

const quiz: QuizClock = { id: "quiz", status: "live", paused: false, skip_signal: 0, question_deadline_at: "2026-10-31T00:00:20Z", question_paused_at: null };
describe("automatic shared quiz advancement", () => {
  it("advances immediately at the question deadline, never before", () => {
    expect(shouldAdvanceQuestion(quiz, Date.parse("2026-10-31T00:00:19.999Z"))).toBe(false);
    expect(shouldAdvanceQuestion(quiz, Date.parse("2026-10-31T00:00:20Z"))).toBe(true);
  });
  it("does not advance paused questions", () => {
    expect(shouldAdvanceQuestion({ ...quiz, paused: true }, Date.parse("2026-10-31T00:01:00Z"))).toBe(false);
  });
  it("uses the same remaining time for late arrivals", () => {
    expect(questionSecondsLeft(quiz, Date.parse("2026-10-31T00:00:15Z"))).toBe(5);
  });
  it("freezes time at the shared pause timestamp", () => {
    expect(questionSecondsLeft({ ...quiz, paused: true, question_paused_at: "2026-10-31T00:00:12Z" }, Date.parse("2026-10-31T00:01:00Z"))).toBe(8);
  });
  it("respects extra time", () => {
    expect(shouldAdvanceQuestion({ ...quiz, question_deadline_at: "2026-10-31T00:00:35Z" }, Date.parse("2026-10-31T00:00:20Z"))).toBe(false);
  });
});