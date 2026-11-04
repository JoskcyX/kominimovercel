import { useEffect, useRef, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withinReconnectGrace } from "@/lib/live-connection";

export function DailyConnection({ url, audioOnly, onLeave, onConnectionChange }: {
  url: string; audioOnly: boolean; onLeave: () => void; onConnectionChange?: ((connected: boolean) => void) | undefined;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const call = useRef<DailyCall | null>(null);
  const callbacks = useRef({ onLeave, onConnectionChange });
  callbacks.current = { onLeave, onConnectionChange };
  const retry = useRef<() => void>(() => {});
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    let disposed = false;
    let interruptedAt: number | null = null;
    let joining = false;
    let hasJoined = false;
    let fatal = false;
    const connection = (connected: boolean) => callbacks.current.onConnectionChange?.(connected);
    const interrupted = () => {
      if (disposed) return;
      interruptedAt ??= Date.now();
      setStatus(navigator.onLine ? "Reconnecting…" : "Offline · reconnecting…");
      connection(false);
    };
    const join = async () => {
      const instance = call.current;
      if (!instance || joining || disposed || !navigator.onLine) return;
      if (instance.meetingState() === "joined-meeting" && !fatal) return;
      joining = true;
      try {
        if (fatal && instance.meetingState() === "joined-meeting") await instance.leave();
        const parsed = new URL(url);
        const token = parsed.searchParams.get("t");
        parsed.searchParams.delete("t");
        await instance.join({ url: parsed.toString(), ...(token ? { token } : {}) });
      } catch { interrupted(); }
      finally { joining = false; }
    };
    retry.current = () => { if (interruptedAt !== null) { fatal = true; void join(); } };
    void import("@daily-co/daily-js").then(({ default: Daily }) => {
      if (disposed || !mount.current) return;
      const instance = Daily.createFrame(mount.current, { showLeaveButton: true });
      call.current = instance;
      const frame = instance.iframe();
      if (frame) { frame.className = "size-full border-0"; frame.title = "Live class"; }
      instance.on("joined-meeting", () => {
        if (disposed) return;
        hasJoined = true; fatal = false; interruptedAt = null;
        setStatus("Connected"); connection(true);
      });
      instance.on("network-connection", (event) => {
        if (event?.event === "interrupted") interrupted();
        if (event?.event === "connected" && event.type !== "signaling" && instance.meetingState() === "joined-meeting") {
          interruptedAt = null; fatal = false; setStatus("Connected"); connection(true);
        }
      });
      instance.on("error", () => { fatal = true; interrupted(); });
      instance.on("left-meeting", () => {
        if (disposed) return;
        connection(false);
        if (interruptedAt !== null || fatal || !navigator.onLine) { interrupted(); void join(); }
        else if (hasJoined) callbacks.current.onLeave();
      });
      void join();
    }).catch(interrupted);
    const offline = () => interrupted();
    const recover = () => { if (interruptedAt !== null) void join(); };
    const visible = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(() => {
      if (interruptedAt === null) return;
      if (!withinReconnectGrace(interruptedAt, Date.now())) { callbacks.current.onLeave(); return; }
      void join();
    }, 3000);
    return () => {
      disposed = true; clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visible);
      const instance = call.current; call.current = null;
      void instance?.destroy();
    };
  }, [url]);

  return <>
    <div ref={mount} className={audioOnly ? "pointer-events-none fixed size-px opacity-0" : "size-full"} />
    <div className="absolute bottom-2 left-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-card-foreground shadow-lg" role="status">
      <span className={`size-2 shrink-0 rounded-full ${status === "Connected" ? "bg-success" : "bg-warning"}`} />
      <span className="text-xs font-bold">{status}</span>
      {status !== "Connected" && <Button size="icon" variant="ghost" aria-label="Reconnect live class" title="Reconnect" onClick={() => retry.current()}><RotateCw className="size-4" /></Button>}
    </div>
  </>;
}