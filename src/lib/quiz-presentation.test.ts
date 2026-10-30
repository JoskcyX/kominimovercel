import { describe, expect, it } from "vitest";
import { getPresentationProgress } from "./quiz-presentation";

describe("live quiz presentation", () => {
  it("shows the current question until everyone has answered", () => {
    const answers = [{ question_id: "q1", participant_id: "a" }];
    expect(getPresentationProgress(["q1", "q2"], answers, ["a", "b"]).index).toBe(0);
    expect(getPresentationProgress(["q1", "q2"], [...answers, { question_id: "q1", participant_id: "b" }], ["a", "b"]).index).toBe(1);
  });
  it("shows final standings after all questions are answered", () => {
    expect(getPresentationProgress(["q1"], [{ question_id: "q1", participant_id: "a" }], ["a"]).complete).toBe(true);
  });
  it("ignores removed players and duplicate responses", () => {
    const answers = [{ question_id: "q1", participant_id: "a" }, { question_id: "q1", participant_id: "a" }, { question_id: "q1", participant_id: "removed" }];
    expect(getPresentationProgress(["q1"], answers, ["a", "b"])).toEqual({ index: 0, answered: 1, total: 2, complete: false });
  });
});