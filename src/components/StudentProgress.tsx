import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { formatMs } from "@/lib/quiz";

type ProgressRow = {
  name: string;
  phone: string;
  sessions: number;
  total_score: number;
  avg_score: number;
  avg_time_ms: number;
  last_played: string;
};

export function StudentProgress() {
  const progress = useQuery({
    queryKey: ["student-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tutor_student_progress");
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });

  const rows = progress.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <TrendingUp className="size-6 shrink-0 text-primary" /> Student progress
          </h2>
          <p className="text-sm text-muted-foreground">
            How each student performs across every quiz you've run.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={rows.length === 0}
          className="chunky rounded-xl border-2 font-bold"
          onClick={() =>
            downloadCsv(
              "edxka-student-progress",
              ["Name", "Phone", "Quizzes taken", "Total correct", "Avg score", "Avg time", "Last played"],
              rows.map((row) => [
                row.name,
                row.phone,
                row.sessions,
                row.total_score,
                row.avg_score,
                formatMs(row.avg_time_ms),
                new Date(row.last_played).toLocaleDateString(),
              ]),
            )
          }
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 && (
          <div className="surface-card p-8 text-center text-muted-foreground">
            Once students play your quizzes, their progress shows up here.
          </div>
        )}
        {rows.map((row) => (
          <div
            key={`${row.name}-${row.phone}`}
            className="surface-card grid min-w-0 gap-3 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:px-5"
          >
            <div>
              <p className="break-words font-bold">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.phone}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
              <span className="text-muted-foreground">{row.sessions} quizzes</span>
              <span className="text-primary">{row.avg_score} avg correct</span>
              <span className="text-muted-foreground">{formatMs(row.avg_time_ms)} avg</span>
              <span className="text-xs text-muted-foreground">
                {new Date(row.last_played).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
