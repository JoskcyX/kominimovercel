# Performance & scale

Goal: a thousand students (or more) joining a class, answering a question in the same second, or sitting in a live class — without errors or slowdowns.

## What we measured

`scripts/load.mjs` runs N simulated students against the **production build** and a real PostgreSQL, then **checks correctness** (nobody lost, nobody counted twice). Results below are from one small machine **with a single CPU core shared by the app, the database and the load generator** — a deliberately harsh setup. Your hosting will be faster, and it can add more servers.

| Scenario (1,000 students) | Result |
| --- | --- |
| All join one class **in the same instant** | 0 errors; all 1,000 admitted exactly once; no duplicates; done in ~6 s |
| All join a quiz, then **all submit each of 3 answers in the same instant** | 0 errors; all 3,000 answers recorded exactly once; every score correct; leaderboard still returns only the top 30 |
| **Live class in session** (home poll every 4 s, attendance every 20 s) | 0 errors; typical request **2 ms**; slowest 5 % under **110 ms**; slowest 1 % under **240 ms**; all 1,000 attendance records correct; server used ~1 ms of CPU per request |

Honest limits of these numbers:
- When *literally everyone* fires in the same millisecond, requests queue behind one CPU core and individual students wait a few seconds (join storm / answer burst). Real classes spread out, and each extra server instance absorbs its share.
- The live-class figure is for the steady state, which is what lasts for an hour.
- Nothing here was measured on Neon, Vercel or Daily themselves. Network distance, database size and the video provider's limits are not included.

## What changed, and why it matters

| Problem | Fix | Effect |
| --- | --- | --- |
| Every student polled 3 endpoints, each re-running the same queries (0.82 requests/student/s) | One **shared per-class snapshot** (one query, cached ~1.5 s) answers everyone; slides merged into the same poll | **−64 % requests** (~735k → ~260k per 250-student class-hour); database work per student ≈ 0 |
| First poll of 1,000 students each loaded the whole snapshot (thundering herd) | First poll only does a tiny lookup, then joins the shared snapshot | Slowest-5 % latency **5 s → 0.1 s** at 1,000 students |
| Every heartbeat locked the *whole class row* | Lock only the student's own row | Heartbeats from different students never block each other |
| Rate limits wrote to **one shared row per school IP**, so 1,000 joins/answers queued behind one lock | In-memory limits for joins, answers, heartbeats and video tokens (the signed token already bounds abuse); database limits kept for contact form, uploads, exports | No hot row; two fewer database writes per answer |
| Scoring re-counted all of a student's answers on each answer | Incremental, O(1) | Constant cost however long the quiz |
| "Is this a returning student?" regex-scanned the whole class on every join | Indexed normalised copies | Join cost no longer grows with class size |
| Leaderboard sent every player to every phone (~100 KB × hundreds of req/s) | Top N + total; a student's own rank fetched once at the end | Payload stays tiny at any size |
| All phones auto-submitted "time's up" in the same instant | Spread randomly over ~1.5 s (answers made by the student are never delayed) | Smooths the biggest burst |
| Every tutor call re-loaded the profile (2 queries) | 15-second profile cache (token still verified every request) | About half the database work for tutor screens |
| Phones polled while in the background; polls were in lockstep; retries piled on a struggling server | `usePolling`: pauses in background, ±15 % jitter, exponential back-off, instant refresh on return | Fewer, smoother requests |
| Transaction start used 3 round trips; HMAC key re-imported per request; pool of 5 | 1 round trip; key cached; pool of 10 (`DB_POOL_MAX`) | Lower latency and CPU per request |
| Daily's token API would be hit by hundreds of students at once | Queue + retry with back-off on 429; reuse a student's token on reconnect | Survives provider rate limits |
| 45 KB sign-in SDK downloaded by every student | Loaded only when someone signs in | **−46 KB gzip (−21 %)** on every page |

## Trade-offs you should know

- **In-memory limits and caches are per server instance.** With many instances, the effective limit is higher than the number in the code (a flood is still bounded by quiz/class caps in SQL). The shared database limiter is kept where precision matters.
- **A suspension or role change reaches other instances within ~15 s** (the profile cache). It is applied immediately on the instance that handled the change, and admin SQL functions re-check the role themselves.
- **A new slide or class status can take up to ~6 s to appear** for students (2 s while a presentation is active, 4 s while live, 6 s otherwise).
- Class and quiz data is shared for ~1–1.5 s between students on one instance. It is never user-specific.

## Sizing guidance (verify with your own load tests)

- **Vercel:** Pro plan, Node 22, keep the *Fluid compute* default, and pick the region closest to your Neon region. A 1,000-student class-hour is about **1 million requests** — check your plan's included invocations.
- **Neon:** use the **pooled** connection string. Enable autoscaling with a floor of at least 0.5–1 CU and consider turning off scale-to-zero during class hours to avoid a cold start when 500 students arrive together.
- **Daily:** you are billed per participant-minute and Daily has its own concurrency and API limits; confirm them for your plan. This will likely be your largest cost.
- **Tutor screen:** with a 1,000-student class the member list re-renders every few seconds; it works, but virtualising that list is the next front-end improvement.

## Reproduce

```bash
NITRO_PRESET=node-server npm run build
LOAD_DATABASE_URL=postgres://…/kominimo_test LOAD_STUDENTS=1000 LOAD_SCENARIO=all node scripts/load.mjs
# LOAD_SCENARIO = join | quiz | class | all ;  LOAD_SECONDS sets the class length
```
Set `SERVER_TIMING=on` on a server to get a `Server-Timing` header with the time each request spent inside the app (the load script does this to separate app time from queueing).
