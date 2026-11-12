/**
 * Errors that are safe to show people. Anything else is logged on the server and replaced with a
 * generic message so stack traces, SQL and table names never reach a browser.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "SUSPENDED"
  | "LEGAL_REQUIRED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INVALID"
  | "LIMIT_REACHED"
  | "CONFLICT"
  | "UNAVAILABLE";

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
  }
}

/** Database exception messages raised by our own SQL functions → friendly text. */
const DB_MESSAGES: Record<string, [ErrorCode, string]> = {
  class_full: [
    "LIMIT_REACHED",
    "This class is full. Upgrade the plan or remove a student to make room.",
  ],
  consent_required: [
    "INVALID",
    "You need to accept the Terms of Use and Privacy Policy to continue.",
  ],
  invalid_details: ["INVALID", "Please enter a valid name and phone or matric number."],
  quiz_not_open: ["CONFLICT", "This quiz isn't open for joining right now."],
  quiz_full: ["LIMIT_REACHED", "This quiz has reached its maximum number of players."],
  quiz_paused: ["CONFLICT", "The quiz is paused."],
  question_not_open: ["CONFLICT", "That question isn't open yet."],
  participant_not_found: ["NOT_FOUND", "Your session has expired. Please rejoin."],
  question_not_in_quiz: ["INVALID", "That question doesn't belong to this quiz."],
  class_not_found: ["NOT_FOUND", "We couldn't find that class."],
  course_not_found: ["NOT_FOUND", "We couldn't find that course."],
  payment_required: ["CONFLICT", "This course needs payment before you can enrol."],
  forbidden: ["FORBIDDEN", "You don't have permission to do that."],
  "not authorized": ["FORBIDDEN", "You don't have permission to do that."],
  "Not a class rep": ["FORBIDDEN", "You're not a class rep."],
  "Not allowed": ["FORBIDDEN", "That action isn't allowed."],
};

/** Readable detail for the SERVER log only (never sent to a browser). Handles non-Error values such as WebSocket ErrorEvents. */
function describe(e: unknown): string {
  if (e instanceof Error)
    return `${e.name}: ${e.message}${(e as { code?: string }).code ? ` [${(e as { code?: string }).code}]` : ""}`;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error?: unknown; type?: unknown; code?: unknown };
    const inner = o.error instanceof Error ? o.error.message : o.error;
    return `${o.type ?? "non-Error"}: ${o.message ?? inner ?? ""} ${o.code ?? ""}`.trim();
  }
  return String(e);
}

/** Network-level failures reaching the database (wrong host/credentials, blocked port, DB asleep/unreachable). */
const CONNECTION_PATTERN =
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNRESET|password authentication failed|no pg_hba|does not exist|Connection terminated|connection timeout|WebSocket|non-101|Received network error|server closed the connection|too many clients|role "app_runtime"|SSL/i;

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = e instanceof Error ? e.message : describe(e);
  for (const [needle, [code, text]] of Object.entries(DB_MESSAGES)) {
    if (msg === needle || msg.includes(`: ${needle}`) || msg.endsWith(needle))
      return new AppError(code, text);
  }
  // Row Level Security / grant rejections from the database mean "not yours".
  if (/permission denied|row-level security/i.test(msg))
    return new AppError("FORBIDDEN", "You don't have permission to do that.");
  if (
    CONNECTION_PATTERN.test(`${msg} ${describe(e)}`) &&
    !/permission denied|row-level security/i.test(msg)
  ) {
    console.error(
      `[server] DATABASE CONNECTION PROBLEM — ${describe(e)}\n  → Check DATABASE_URL (host, user, password, ?sslmode=require), that the app_runtime role has LOGIN, and your network.`,
    );
    return new AppError(
      "UNAVAILABLE",
      "We can't reach the database right now. Please try again in a moment.",
    );
  }
  console.error(`[server] unexpected error: ${describe(e)}`, e);
  return new AppError("UNAVAILABLE", "Something went wrong on our side. Please try again.");
}
