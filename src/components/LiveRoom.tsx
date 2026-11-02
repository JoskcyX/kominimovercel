import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Starts as a small floating window so the class page stays usable; expand anytime.
// audioOnly keeps the room connected (tutor's voice) with the video hidden — used during pop quizzes.
// overlay renders on top of the video (e.g. the tutor's "student wants to join" notices).
export function LiveRoom({ url, onLeave, leaveLabel = "Leave", startExpanded = false, audioOnly = false, overlay }: { url: string; onLeave: () => void; leaveLabel?: string; startExpanded?: boolean; audioOnly?: boolean; overlay?: React.ReactNode }) {
  const [big, setBig] = useState(startExpanded);
  if (audioOnly) {
    return (
      <>
        <iframe src={url} title="Live class audio" allow="camera; microphone; autoplay" className="pointer-events-none fixed size-px opacity-0" aria-hidden />
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border-2 border-foreground bg-foreground px-4 py-2 shadow-2xl">
          <span className="pulse-dot size-2 rounded-full bg-primary" />
          <span className="text-sm font-bold text-background">Live class audio</span>
          <Button size="sm" variant="secondary" onClick={onLeave} aria-label={leaveLabel} className="h-11 min-w-11 rounded-full px-2 font-bold sm:h-7 sm:min-w-7" aria-label="Leave live class">
            <X className="size-4" />
          </Button>
        </div>
      </>
    );
  }
  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden bg-foreground shadow-2xl",
        big ? "inset-0 h-dvh pb-[env(safe-area-inset-bottom)]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 h-[min(230px,40dvh)] w-[min(380px,calc(100vw-1.5rem))] rounded-2xl border-2 border-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-background">
          <span className="pulse-dot size-2 rounded-full bg-primary" /> Live class
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setBig(!big)} className="h-11 min-w-11 rounded-full px-2 font-bold sm:h-7 sm:min-w-7" aria-label={big ? "Minimise" : "Expand"}>
            {big ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button size="sm" variant="secondary" onClick={onLeave} aria-label={leaveLabel} className="h-11 min-w-11 rounded-full px-2 font-bold sm:h-7 sm:min-w-7">
            <X className="size-4" /> {big && leaveLabel}
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe src={url} title="Live class" allow="camera; microphone; fullscreen; display-capture; autoplay" className="size-full border-0" />
        {overlay && <div className="absolute left-2 top-2 z-10 grid max-h-[80%] w-[min(320px,calc(100%-1rem))] gap-2 overflow-y-auto">{overlay}</div>}
      </div>
    </div>
  );
}
