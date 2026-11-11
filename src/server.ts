import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./server/security-headers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Per-request CSP nonce. The router (src/router.tsx) reads it from this AsyncLocalStorage so every
 * inline script TanStack Start emits carries the nonce. Where AsyncLocalStorage isn't available we
 * fall back to a CSP that allows inline scripts (still blocks everything else).
 */
type NonceStore = {
  run<T>(store: { nonce: string }, fn: () => T): T;
  getStore(): { nonce: string } | undefined;
};
let nonceStore: NonceStore | null = null;
const nonceReady = (async () => {
  try {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    nonceStore = new AsyncLocalStorage<{ nonce: string }>() as NonceStore;
    (globalThis as { __cspNonceStore?: NonceStore }).__cspNonceStore = nonceStore;
  } catch {
    nonceStore = null;
  }
})();

const newNonce = () => btoa(crypto.randomUUID());
const PROD = import.meta.env.PROD;

function harden(response: Response, request: Request, nonce: string | null): Response {
  if (!PROD) return response;
  try {
    return applySecurityHeaders(response, new URL(request.url), nonce);
  } catch (e) {
    console.error("[security-headers]", e);
    return response;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    await nonceReady;
    const nonce = PROD && nonceStore ? newNonce() : null;
    try {
      const handler = await getServerEntry();
      const run = () => handler.fetch(request, env, ctx);
      const response =
        nonce && nonceStore ? await nonceStore.run({ nonce }, async () => run()) : await run();
      return harden(await normalizeCatastrophicSsrResponse(response), request, nonce);
    } catch (error) {
      console.error(error);
      return harden(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        null,
      );
    }
  },
};
