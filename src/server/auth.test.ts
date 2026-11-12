// @vitest-environment node
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://auth.example.com";
const ID = "3f2b8c1e-9d4a-4e6b-8a1c-0123456789ab";
let verify: typeof import("./auth").verifyAccessToken;
let jwks: ReturnType<typeof createLocalJWKSet>;
let priv: CryptoKey;

async function token(
  opts: {
    sub?: string;
    iss?: string;
    aud?: string;
    exp?: string;
    key?: CryptoKey;
    alg?: string;
  } = {},
) {
  return new SignJWT({ email: "ada@example.dev", name: "Ada" })
    .setProtectedHeader({ alg: (opts.alg ?? "EdDSA") as "EdDSA", kid: "k1" })
    .setSubject(opts.sub ?? ID)
    .setIssuer(opts.iss ?? ORIGIN)
    .setAudience(opts.aud ?? ORIGIN)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? priv);
}

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost/db");
  vi.stubEnv("NEON_AUTH_BASE_URL", `${ORIGIN}/db/auth`);
  vi.stubEnv("SESSION_SECRET", "a".repeat(48));
  const kp = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  priv = kp.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(kp.publicKey)), alg: "EdDSA", kid: "k1", use: "sig" }],
  });
  const mod = await import("./auth");
  verify = (t) =>
    mod.verifyAccessToken(t, { jwks: jwks as never, issuers: [ORIGIN, `${ORIGIN}/db/auth`] });
});

describe("verifyAccessToken", () => {
  it("accepts a good token and returns the identity", async () => {
    await expect(verify(await token())).resolves.toEqual({
      id: ID,
      email: "ada@example.dev",
      name: "Ada",
    });
  });
  it("accepts the full Auth URL as issuer/audience as well as the host origin", async () => {
    await expect(
      verify(await token({ iss: `${ORIGIN}/db/auth`, aud: `${ORIGIN}/db/auth` })),
    ).resolves.toMatchObject({ id: ID });
  });
  it("rejects wrong issuer, audience, expired, and foreign-key tokens", async () => {
    await expect(verify(await token({ iss: "https://evil.example" }))).rejects.toThrow();
    await expect(verify(await token({ aud: "https://evil.example" }))).rejects.toThrow();
    await expect(verify(await token({ exp: "-1m" }))).rejects.toThrow();
    const other = await generateKeyPair("EdDSA", { crv: "Ed25519" });
    await expect(verify(await token({ key: other.privateKey }))).rejects.toThrow();
  });
  it("rejects a non-UUID subject (can't smuggle other values into the DB identity)", async () => {
    await expect(verify(await token({ sub: "1; DROP TABLE x" }))).rejects.toThrow();
  });
  it("rejects unsigned 'alg: none' tokens and garbage", async () => {
    const none = `${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({ sub: ID, iss: ORIGIN, aud: ORIGIN }))}.`;
    await expect(verify(none)).rejects.toThrow();
    await expect(verify("not-a-jwt")).rejects.toThrow();
  });
});
