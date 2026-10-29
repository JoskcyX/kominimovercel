import type { QuestionType } from "./quiz";

export type ParsedQuestion = {
  prompt: string;
  type: QuestionType;
  options: string[];
  correct_answer: string;
  warning?: string | undefined;
};

const OPTION_LETTERS = "ABCDEFGH";

/** Splits pasted text into blocks that each start with "1." / "1)" / "Q1." */
function splitBlocks(raw: string): string[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const marker = /(?:^|\n|\s)(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)]\s+/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(text))) {
    // Ignore a numbered marker that sits right after "Answer:" text.
    const before = text.slice(Math.max(0, match.index - 12), match.index).toLowerCase();
    if (/answer\s*[:\-]\s*$/.test(before)) continue;
    starts.push(match.index === 0 ? 0 : match.index + match[0].search(/\S/));
  }

  if (starts.length === 0) {
    // Fall back to blank-line separated blocks.
    return text
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  return starts
    .map((start, i) => text.slice(start, starts[i + 1] ?? text.length).trim())
    .filter(Boolean);
}

function stripLeadingNumber(value: string): string {
  return value.replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.)]\s*/i, "").trim();
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseQuestionBlock(block: string): ParsedQuestion | null {
  const cleaned = block.trim();
  if (!cleaned) return null;

  // Pull out the answer line first.
  const answerMatch = cleaned.match(
    /(?:^|\n|\s)(?:correct\s*answer|answer|ans|correct)\s*[:\-–]\s*([^\n]*)/i,
  );
  const rawAnswer = (answerMatch?.[1] ?? "").trim();
  const body = answerMatch ? cleaned.slice(0, answerMatch.index).trim() : cleaned;

  // Find option markers: "A." "A)" "(A)" "a."
  const optionRegex = /(?:^|\n|\s|\()([A-Ha-h])\s*[.)]\s+/g;
  const found: { letter: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(body))) {
    const letter = m[1]!.toUpperCase();
    const expected = OPTION_LETTERS[found.length];
    if (letter !== expected) continue;
    found.push({ letter, start: m.index, end: m.index + m[0].length });
  }

  const promptEnd = found.length > 0 ? found[0]!.start : body.length;
  const prompt = stripLeadingNumber(body.slice(0, promptEnd)).replace(/\s+/g, " ").trim();
  if (!prompt) return null;

  const options = found.map((opt, i) =>
    body
      .slice(opt.end, found[i + 1]?.start ?? body.length)
      .replace(/\s+/g, " ")
      .trim(),
  );

  // No options → true/false or short answer.
  if (options.length < 2) {
    const tf = rawAnswer.match(/^\(?\s*(true|false|t|f|yes|no)\s*\)?\.?$/i);
    if (tf) {
      const word = tf[1]!.toLowerCase();
      const isTrue = word === "true" || word === "t" || word === "yes";
      return {
        prompt,
        type: "true_false",
        options: ["True", "False"],
        correct_answer: isTrue ? "True" : "False",
      };
    }
    return {
      prompt,
      type: "short_answer",
      options: [],
      correct_answer: rawAnswer,
      warning: rawAnswer ? undefined : "No answer found",
    };
  }

  // Multiple choice — resolve the answer to one of the options.
  let correct = "";
  const letterOnly = rawAnswer.match(/^\(?\s*([A-Ha-h])\s*\)?\s*[.):-]?\s*(.*)$/);
  if (letterOnly) {
    const index = OPTION_LETTERS.indexOf(letterOnly[1]!.toUpperCase());
    if (index >= 0 && index < options.length) correct = options[index]!;
  }
  if (!correct && rawAnswer) {
    const target = normalise(rawAnswer);
    const hit = options.find((option) => normalise(option) === target);
    if (hit) correct = hit;
  }

  return {
    prompt,
    type: "multiple_choice",
    options,
    correct_answer: correct,
    warning: correct ? undefined : "Couldn't match the answer — pick it manually",
  };
}

export function parseQuestions(raw: string): ParsedQuestion[] {
  return splitBlocks(raw)
    .map(parseQuestionBlock)
    .filter((question): question is ParsedQuestion => question !== null);
}
