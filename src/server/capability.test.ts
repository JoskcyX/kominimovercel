// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

const ID = "3f2b8c1e-9d4a-4e6b-8a1c-0123456789ab";
let cap: typeof import("./capability");

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost/db");
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com/db/auth");
  vi.stubEnv("SESSION_SECRET", "a".repeat(48));
  cap = await import("./capability");
});

describe("student capability tokens", () => {
  it("round-trips for the right kind", async () => {
    const t = await cap.signCapability("participant", ID, 60);
    await expect(cap.verifyCapability("participant", t)).resolves.toBe(ID);
  });
  it("can't be used for a different kind of actor", async () => {
    const t = await cap.signCapability("participant", ID, 60);
    await expect(cap.verifyCapability("member", t)).rejects.toThrow();
  });
  it("rejects a tampered id, expiry or signature", async () => {
    const t = await cap.signCapability("member", ID, 60);
    const [v, k, , exp, sig] = t.split(".");
    const other = "00000000-0000-4000-8000-000000000000";
    await expect(
      cap.verifyCapability("member", [v, k, other, exp, sig].join(".")),
    ).rejects.toThrow();
    await expect(
      cap.verifyCapability("member", [v, k, ID, String(Number(exp) + 99999), sig].join(".")),
    ).rejects.toThrow();
    await expect(cap.verifyCapability("member", t.slice(0, -3) + "AAA")).rejects.toThrow();
  });
  it("rejects expired tokens", async () => {
    const t = await cap.signCapability("member", ID, -10);
    await expect(cap.verifyCapability("member", t)).rejects.toThrow(/expired/i);
  });
  it.each(["", "garbage", "v1.member.x.y.z", "v2.member." + ID + ".9999999999.sig", "a.b.c.d.e.f"])(
    "rejects malformed token %j",
    async (t) => {
      await expect(cap.verifyCapability("member", t)).rejects.toThrow();
    },
  );
});
