import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, slugify } from "@/lib/csv";
import { formatMs } from "@/lib/quiz";

type StatRow = {
  question_id: string;
  order_index: number;
  prompt: string;
  correct_answer: string;
  answered: number;
  correct: number;
  accuracy: number;
  avg_time_ms: number;
};

type Person = {
  id: string;
  name: string;
  phone: string;
  score: number;
  total_time_ms: number;
  finished_at: string | null;
};

export function QuizAnalytics({
  quizId,
  title,
  participants,
}: {
  quizId: string;
  title: string;
  participants: Person[];
}) {
  const stats = useQuery({
    queryKey: ["question-stats", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("question_stats", { _quiz_id: quizId });
      if (error) throw error;
      return (data ?? []) as StatRow[];
    },
    refetchInterval: 8000,
  });

  const rows = stats.data ?? [];
  const totalAnswers = rows.reduce((sum, row) => sum + row.answered, 0);
  const totalCorrect = rows.reduce((sum, row) => sum + row.correct, 0);
  const overall = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 1000) / 10 : 0;
  const hardest = [...rows].filter((row) => row.answered > 0).sort((a, b) => a.accuracy - b.accuracy)[0];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="size-6 shrink-0 text-primary" /> Question analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Live accuracy and speed for every question in this session.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            variant="outline"
            className="chunky rounded-xl border-2 font-bold"
            onClick={() =>
              downloadCsv(
                `${slugify(title)}-leaderboard`,
                ["Rank", "Name", "Phone", "Correct", "Total time", "Status"],
                participants.map((person, index) => [
                  index + 1,
                  person.name,
                  person.phone,
                  person.score,
                  formatMs(person.total_time_ms),
                  person.finished_at ? "Done" : "Playing",
                ]),
              )
            }
          >
            <Download className="size-4" /> Leaderboard CSV
          </Button>
          <Button
            variant="outline"
            className="chunky rounded-xl border-2 font-bold"
            onClick={() =>
              downloadCsv(
                `${slugify(title)}-questions`,
                ["#", "Question", "Correct answer", "Answered", "Correct", "Accuracy %", "Avg time"],
                rows.map((row, index) => [
                  index + 1,
                  row.prompt,
                  row.correct_answer,
                  row.answered,
                  row.correct,
                  row.accuracy,
                  formatMs(row.avg_time_ms),
                ]),
              )
            }
          >
            <Download className="size-4" /> Questions CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Answers in</p>
          <p className="font-display text-3xl font-bold">{totalAnswers}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Overall accuracy</p>
          <p className="font-display text-3xl font-bold text-primary">{overall}%</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hardest question</p>
          <p className="mt-1 line-clamp-2 text-sm font-bold">
            {hardest ? `#${hardest.order_index} · ${hardest.prompt}` : "No data yet"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 && (
          <div className="surface-card p-8 text-center text-muted-foreground">
            Stats appear as soon as students start answering.
          </div>
        )}
        {rows.map((row, index) => (
          <div key={row.question_id} className="surface-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 max-w-xl break-words font-bold">
                <span className="text-muted-foreground">{index + 1}.</span> {row.prompt || "Untitled question"}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
                <span className="text-primary">{row.accuracy}%</span>
                <span className="text-muted-foreground">
                  {row.correct}/{row.answered}
                </span>
                <span className="text-muted-foreground">{formatMs(row.avg_time_ms)}</span>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, row.accuracy)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
