import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Starts as a small floating window so the class page stays usable; expand anytime.
// audioOnly keeps the room connected (tutor's voice) with the video hidden — used during pop quizzes.
export function LiveRoom({ url, onLeave, leaveLabel = "Leave", startExpanded = false, audioOnly = false }: { url: string; onLeave: () => void; leaveLabel?: string; startExpanded?: boolean; audioOnly?: boolean }) {
  const [big, setBig] = useState(startExpanded);
  if (audioOnly) {
    return (
      <>
        <iframe src={url} title="Live class audio" allow="camera; microphone; autoplay" className="pointer-events-none fixed size-px opacity-0" aria-hidden />
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border-2 border-foreground bg-foreground px-4 py-2 shadow-2xl">
          <span className="pulse-dot size-2 rounded-full bg-primary" />
          <span className="text-sm font-bold text-background">Live class audio</span>
          <Button size="sm" variant="secondary" onClick={onLeave} className="h-7 rounded-full px-2 font-bold" aria-label="Leave live class">
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
        big ? "inset-0" : "bottom-4 right-4 h-[230px] w-[min(380px,calc(100vw-2rem))] rounded-2xl border-2 border-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-background">
          <span className="pulse-dot size-2 rounded-full bg-primary" /> Live class
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setBig(!big)} className="h-7 rounded-full px-2 font-bold" aria-label={big ? "Minimise" : "Expand"}>
            {big ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button size="sm" variant="secondary" onClick={onLeave} className="h-7 rounded-full px-2 font-bold">
            <X className="size-4" /> {big && leaveLabel}
          </Button>
        </div>
      </div>
      <iframe src={url} title="Live class" allow="camera; microphone; fullscreen; display-capture; autoplay" className="w-full flex-1 border-0" />
    </div>
  );
}
