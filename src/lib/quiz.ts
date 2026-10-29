export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export type PlayableQuestion = {
  id: string;
  order_index: number;
  type: QuestionType;
  prompt: string;
  options: string[];
  time_limit: number;
};

export type BoardRow = {
  id: string;
  name: string;
  score: number;
  total_time_ms: number;
  finished: boolean;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeJoinCode(length = 6): string {
  let out = "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 100) / 10);
  if (total < 60) return `${total.toFixed(1)}s`;
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  return `${mins}m ${secs}s`;
}

export function questionTypeLabel(type: QuestionType): string {
  if (type === "multiple_choice") return "Multiple choice";
  if (type === "true_false") return "True / False";
  return "Short answer";
}

export function toOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export const MEDAL = ["🥇", "🥈", "🥉"] as const;
