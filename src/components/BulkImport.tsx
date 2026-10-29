import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardPaste, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseQuestions } from "@/lib/parse-questions";
import { questionTypeLabel } from "@/lib/quiz";

const SAMPLE = `1. Who built the ark according to the Bible?
A. Abraham  B. Moses  C. Noah  D. David
Answer: C. Noah

2. Who was the first king of Israel?
A. David  B. Saul  C. Solomon  D. Samuel
Answer: B. Saul`;

export function BulkImport({ quizId, startIndex }: { quizId: string; startIndex: number }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [timeLimit, setTimeLimit] = useState(20);

  const parsed = useMemo(() => parseQuestions(text), [text]);
  const warnings = parsed.filter((question) => question.warning).length;

  const importAll = useMutation({
    mutationFn: async () => {
      if (parsed.length === 0) throw new Error("Nothing to import yet");
      const rows = parsed.map((question, i) => ({
        quiz_id: quizId,
        order_index: startIndex + i + 1,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        correct_answer: question.correct_answer,
        time_limit: Math.min(Math.max(timeLimit, 5), 300),
      }));
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      toast.success(`${count} question${count === 1 ? "" : "s"} added`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import failed"),
  });

  return (
    <section className="surface-card p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
          <ClipboardPaste className="size-5 text-primary" />
        </span>
        <div>
          <h2 className="text-2xl font-bold">Paste your whole question list</h2>
          <p className="text-sm text-muted-foreground">
            Drop in a numbered list with lettered options and an “Answer:” line. Kominimo splits,
            sorts and grades them for you — multiple choice, true/false and typed answers.
          </p>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={SAMPLE}
        rows={10}
        className="mt-4 rounded-xl border-2 font-mono text-sm"
      />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="bulk-timer">Seconds per question</Label>
          <Input
            id="bulk-timer"
            type="number"
            min={5}
            max={300}
            value={timeLimit}
            onChange={(event) => setTimeLimit(Number(event.target.value) || 20)}
            className="h-11 w-32 rounded-xl border-2"
          />
        </div>
        <Button
          onClick={() => importAll.mutate()}
          disabled={parsed.length === 0 || importAll.isPending}
          className="chunky h-11 rounded-xl font-bold"
        >
          <Wand2 className="size-4" />
          Add {parsed.length || ""} question{parsed.length === 1 ? "" : "s"}
        </Button>
        {text.trim() && (
          <Button variant="outline" onClick={() => setText("")} className="h-11 rounded-xl border-2 font-bold">
            Clear
          </Button>
        )}
      </div>

      {warnings > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
          <AlertTriangle className="size-4 text-destructive" />
          {warnings} question{warnings === 1 ? "" : "s"} need the correct answer picked after import
        </p>
      )}

      {parsed.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-bold text-muted-foreground">Preview</p>
          {parsed.map((question, index) => (
            <div key={index} className="rounded-xl border-2 border-border bg-muted/40 p-3">
              <p className="text-sm font-bold">
                {startIndex + index + 1}. {question.prompt}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {questionTypeLabel(question.type)}
                {question.options.length > 0 && ` · ${question.options.join(" / ")}`}
              </p>
              <p className="mt-1 text-xs font-bold text-primary">
                {question.correct_answer ? `Answer: ${question.correct_answer}` : question.warning}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
