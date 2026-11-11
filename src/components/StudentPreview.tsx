import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Eye, Users } from "lucide-react";
import { listQuestionsAdmin } from "@/lib/quizzes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Q = { id: string; order_index: number; type: string; prompt: string; options: unknown; time_limit: number; correct_answer: string };

export function StudentPreview({ quizId, title, open, onOpenChange }: { quizId: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState(-1); // -1 = lobby
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { if (open) { setStep(-1); setPicked(null); } }, [open]);

  const qs = useQuery({
    queryKey: ["preview", quizId],
    enabled: open,
    queryFn: async (): Promise<Q[]> => listQuestionsAdmin({ data: { quizId } }),
  });
  const list = qs.data ?? [];
  const q = step >= 0 ? list[step] : null;
  const opts: string[] = q ? (q.type === "true_false" ? ["True", "False"] : Array.isArray(q.options) ? (q.options as string[]) : []) : [];
  const go = (n: number) => { setStep(n); setPicked(null); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="size-5 text-primary" /> Student preview</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">This is what students see. Nothing here is saved or shared.</p>

        {step === -1 ? (
          <div className="surface-card grid gap-3 p-5 text-center">
            <p className="text-xs font-bold uppercase text-muted-foreground">Lobby</p>
            <h3 className="text-2xl font-bold">{title}</h3>
            <div className="mx-auto flex items-center gap-2 text-sm"><span className="pulse-dot size-2 rounded-full bg-secondary" /> Waiting for the tutor to start…</div>
            <div className="mx-auto flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-4" /> You + classmates appear here</div>
            <Input disabled placeholder="Student name" />
            <p className="text-sm">{qs.isLoading ? "Loading questions…" : `${list.length} question${list.length === 1 ? "" : "s"} ready`}</p>
            <Button disabled={!list.length} onClick={() => go(0)} className="chunky rounded-full font-bold">Start preview <ArrowRight className="size-4" /></Button>
          </div>
        ) : q ? (
          <div className="surface-card grid gap-3 p-5">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>Question {step + 1} of {list.length}</span><span>{q.time_limit}s</span>
            </div>
            <h3 className="text-lg font-bold">{q.prompt}</h3>
            {opts.length ? (
              <div className="grid gap-2">
                {opts.map((o) => {
                  const right = picked && o === q.correct_answer;
                  const wrong = picked === o && o !== q.correct_answer;
                  return (
                    <button key={o} onClick={() => setPicked(o)} className={`rounded-xl border-2 p-3 text-left font-semibold ${right ? "border-secondary bg-secondary/15" : wrong ? "border-destructive bg-destructive/10" : "border-input hover:border-primary"}`}>
                      {o} {right && <Check className="inline size-4" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-2">
                <Input placeholder="Type your answer" />
                <Button variant="outline" size="sm" onClick={() => setPicked("shown")}>Show answer</Button>
              </div>
            )}
            {picked && <p className="text-sm"><span className="font-bold">Correct answer:</span> {q.correct_answer}</p>}
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => go(step - 1)}><ArrowLeft className="size-4" /> {step === 0 ? "Lobby" : "Back"}</Button>
              {step < list.length - 1
                ? <Button size="sm" onClick={() => go(step + 1)}>Next <ArrowRight className="size-4" /></Button>
                : <Button size="sm" onClick={() => onOpenChange(false)}>Finish</Button>}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
