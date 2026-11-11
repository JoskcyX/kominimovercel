/**
 * One-off setup:  APP_ORIGINS="https://your-app.vercel.app,http://localhost:3000" npm run storage:cors
 * Allows browsers on those origins to upload to / read from your Neon Object Storage bucket with
 * presigned URLs. Without this, file uploads from the browser fail with a CORS error.
 */
import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const origins = (process.env["APP_ORIGINS"] ?? process.env["APP_URL"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (origins.length === 0) {
  console.error(
    'Set APP_ORIGINS (comma-separated), e.g. APP_ORIGINS="https://app.example.com,http://localhost:3000"',
  );
  process.exit(1);
}
for (const o of origins) {
  if (o === "*" || !/^https?:\/\/[^/]+$/.test(o)) {
    console.error(`Refusing origin "${o}": use exact origins like https://app.example.com`);
    process.exit(1);
  }
}
const { putBucketCors } = await import("../src/server/storage");
await putBucketCors(origins);
console.log(`CORS set for: ${origins.join(", ")}`);
