import { useEffect, useRef } from "react";

/**
 * Polls `fn` politely. This is what lets a thousand phones watch one class or quiz without
 * hammering the server:
 *
 *  • Jitter  – every delay is randomised ±15 %, so students that joined together drift apart
 *              instead of all asking in the same instant.
 *  • Pause   – nothing is requested while the tab/app is in the background; one refresh happens
 *              the moment the student comes back (or the network returns).
 *  • Backoff – if `fn` throws, the next delay doubles (up to 8×, max 30 s), then resets on success.
 *              This turns a struggling server's retry storm into a trickle.
 *
 * Pass `intervalMs = null` to switch polling off. Changing the interval restarts the schedule.
 */
export function usePolling(
  fn: () => Promise<unknown> | void,
  intervalMs: number | null,
  options: { immediate?: boolean } = {},
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const immediate = options.immediate ?? true;

  useEffect(() => {
    if (intervalMs == null) return;
    let stopped = false;
    let running = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hidden = () => typeof document !== "undefined" && document.hidden;

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || hidden()) return; // resumes via visibilitychange
      const base = Math.min(intervalMs * Math.min(2 ** failures, 8), 30_000);
      timer = setTimeout(() => void tick(), base * (0.85 + Math.random() * 0.3));
    };

    const tick = async () => {
      if (stopped || running) return;
      running = true;
      try {
        await fnRef.current();
        failures = 0;
      } catch {
        failures += 1;
      } finally {
        running = false;
      }
      schedule();
    };

    const wake = () => {
      if (stopped || hidden() || running) return;
      clearTimeout(timer);
      void tick();
    };
    const sleep = () => {
      if (hidden()) clearTimeout(timer);
    };

    const onVisibility = () => (hidden() ? sleep() : wake());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", wake);

    if (immediate) timer = setTimeout(() => void tick(), Math.random() * 250);
    else schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", wake);
    };
  }, [intervalMs, immediate]);
}
