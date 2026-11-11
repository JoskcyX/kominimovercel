/** One import for everything a server function usually needs (keeps handlers short). */
export { withDb, sql, rawSql, setClause, type Tx, type Row } from "./db";
export { AppError } from "./errors";
export { rateLimit, LIMITS } from "./rate-limit";
export { cached } from "./cache";
export { makeCode } from "./codes";
export { serverEnv } from "./env";
export {
  signCapability,
  verifyCapability,
  PARTICIPANT_TOKEN_TTL,
  MEMBER_TOKEN_TTL,
} from "./capability";
export { LEGAL_VERSIONS, STUDENT_CONSENT_TAG } from "../config/legal";
export { tierFor } from "../config/plans";

import { serverEnv } from "./env";
import { AppError } from "./errors";
import { tierFor, isUnlimited, limitLabel } from "../config/plans";
import type { Actor } from "../lib/middleware";

export const enforcing = () => serverEnv().PLAN_ENFORCEMENT === "on";

/** Throws a friendly LIMIT_REACHED error when `current` already meets the plan's cap. */
export function assertWithinPlan(
  actor: Pick<Actor, "plan">,
  key: "maxQuizzes" | "maxCourses" | "maxQuestionsPerQuiz",
  current: number,
  what: string,
) {
  if (!enforcing()) return;
  const tier = tierFor(actor.plan);
  const cap = tier[key];
  if (!isUnlimited(cap) && current >= cap) {
    throw new AppError(
      "LIMIT_REACHED",
      `The ${tier.name} plan allows ${limitLabel(cap)} ${what}. Upgrade to add more.`,
    );
  }
}

/** Run a query that creates a row with a unique random code, retrying on the rare collision. */
export async function withUniqueCode<T>(
  make: () => string,
  attempt: (code: string) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 6; i += 1) {
    try {
      return await attempt(make());
    } catch (e) {
      if (!/duplicate key|unique/i.test(String((e as Error)?.message))) throw e;
    }
  }
  throw new AppError("UNAVAILABLE", "Couldn't generate a unique code. Please try again.");
}
