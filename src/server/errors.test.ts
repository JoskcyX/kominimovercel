import { describe, expect, it, vi } from "vitest";
import { AppError, toAppError } from "./errors";

describe("toAppError", () => {
  it("passes AppErrors through", () => {
    const e = new AppError("NOT_FOUND", "nope");
    expect(toAppError(e)).toBe(e);
  });
  it("maps our own database exceptions to friendly messages", () => {
    expect(toAppError(new Error("class_full"))).toMatchObject({ code: "LIMIT_REACHED" });
    expect(toAppError(new Error("consent_required"))).toMatchObject({ code: "INVALID" });
    expect(toAppError(new Error("forbidden"))).toMatchObject({ code: "FORBIDDEN" });
  });
  it("treats permission / RLS rejections as FORBIDDEN", () => {
    expect(toAppError(new Error("permission denied for table profiles"))).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(toAppError(new Error("new row violates row-level security policy"))).toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("never leaks internals for unexpected errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const e = toAppError(new Error('relation "secret_table" does not exist at /srv/app/db.ts:12'));
    expect(e.code).toBe("UNAVAILABLE");
    expect(e.message).not.toMatch(/secret_table|\/srv/);
    spy.mockRestore();
  });
});
