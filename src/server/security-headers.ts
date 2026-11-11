import { serverEnv } from "./env";

/**
 * HTTP security headers applied to every response.
 *
 *  • CSP: scripts run only if they carry this request's random nonce, so an injected <script>
 *    can't execute. Frames/connections are limited to the services we actually use.
 *  • Permissions-Policy: camera/mic only for us and Daily (live class), nothing else.
 *  • Server-function and API responses are never cached.
 */
const safeOrigin = (url?: string) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};

export function buildCsp(nonce: string | null): string {
  const env = serverEnv();
  const auth = safeOrigin(env.NEON_AUTH_BASE_URL);
  const storage = safeOrigin(env.AWS_ENDPOINT_URL_S3);
  const script = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'";
  const d = [
    `default-src 'self'`,
    `script-src ${script}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' blob: ${storage} https:`,
    `connect-src 'self' ${auth} ${storage} https://*.daily.co wss://*.daily.co https://*.wss.daily.co`,
    `frame-src https://*.daily.co https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com ${storage}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];
  return d.join("; ");
}

const PERMISSIONS = [
  `camera=(self "https://*.daily.co")`,
  `microphone=(self "https://*.daily.co")`,
  `display-capture=(self "https://*.daily.co")`,
  `fullscreen=(self "https://*.daily.co")`,
  `autoplay=(self)`,
  `geolocation=()`,
  `payment=()`,
  `usb=()`,
].join(", ");

export function applySecurityHeaders(res: Response, url: URL, nonce: string | null): Response {
  const headers = new Headers(res.headers);
  const isDocument = (headers.get("content-type") ?? "").includes("text/html");
  if (isDocument) headers.set("Content-Security-Policy", buildCsp(nonce));
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/") || isDocument) {
    headers.set("Cache-Control", "no-store");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
