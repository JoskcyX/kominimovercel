import { describe, expect, it } from "vitest";
import { normalizeAuthUrl } from "./env";

describe("normalizeAuthUrl forgives common copy-paste mistakes", () => {
  const good = "https://ep-x.neonauth.us-east-2.aws.neon.tech/neondb/auth";
  it.each([
    good,
    `${good}/`,
    `${good}/.well-known/jwks.json`, // the JWKS URL pasted by mistake
    `${good}/.well-known/jwks.json/`,
    `  ${good}  `,
  ])("%j → the Auth URL", (input) => {
    expect(normalizeAuthUrl(input)).toBe(good);
  });
});
