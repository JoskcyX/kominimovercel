import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildAttendanceCsv, buildAttendanceXlsx, downloadBlob } from "@/lib/attendance";
import { sessionAttendanceRows } from "@/lib/session-attendance";

type Session = Database["public"]["Tables"]["class_sessions"]["Row"];

function SessionRecord({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const participants = useQuery({
    queryKey: ["class", session.class_id, "attendance", session.id],
    refetchInterval: session.ended_at ? false : 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("class_session_attendance").select("*").eq("session_id", session.id).order("name");
      if (error) throw error;
      return data;
    },
  });
  const rows = sessionAttendanceRows(session, participants.data ?? []);
  const date = new Date(session.started_at);
  const attended = rows.filter((r) => r.status === "Attended").length;
  const download = async (format: "csv" | "xlsx") => {
    if (!participants.data) return;
    setExporting(true);
    try {
      const options = { platform: "Kominimo", classTitle: session.title, subject: session.subject, classCode: session.join_code, classDate: date,
        idLabel: session.id_label === "matric" ? "Matric number" : "Phone number", threshold: session.attendance_threshold,
        sessionMinutes: Math.max(0, Math.round((new Date(session.ended_at ?? Date.now()).getTime() - date.getTime()) / 60000)), rows };
      const blob = format === "csv" ? new Blob(["\ufeff" + buildAttendanceCsv(options)], { type: "text/csv;charset=utf-8" }) : await buildAttendanceXlsx(options);
      const safe = session.title.replace(/[^a-z0-9]+/gi, "-");
      downloadBlob(blob, `${safe}-attendance-${session.started_at.replace(/[:.]/g, "-")}.${format}`);
    } catch { toast.error("Could not download attendance. Please try again."); }
    finally { setExporting(false); }
  };
  return (
    <article className="rounded-lg border-2 border-border bg-card">
      <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open} className="h-auto w-full justify-between gap-3 whitespace-normal rounded-lg p-4 text-left">
        <CalendarDays className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="mt-1 block text-sm font-normal text-muted-foreground">{participants.isPending ? "Loading attendance…" : participants.isError ? "Attendance unavailable" : `${attended} attended · ${rows.length} joined`}{!session.ended_at && " · Live"}</span>
        </span>
        {open ? <ChevronUp className="size-5 shrink-0" /> : <ChevronDown className="size-5 shrink-0" />}
      </Button>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        <Button size="sm" variant="outline" disabled={!participants.data || exporting} onClick={() => download("csv")}><Download className="size-4" /> CSV</Button>
        <Button size="sm" variant="outline" disabled={!participants.data || exporting} onClick={() => download("xlsx")}><Download className="size-4" /> Excel</Button>
      </div>
      {open && <div className="border-t border-border px-4 py-3">
        {participants.isError ? <Button variant="outline" onClick={() => participants.refetch()}>Try again</Button> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{participants.isPending ? "Loading…" : "No students joined this live class."}</p> :
          <ul className="divide-y divide-border">{rows.map((row, i) => <li key={participants.data?.[i]?.id ?? i} className="grid min-w-0 gap-1 py-3">
            <p className="break-words font-bold">{row.name}</p>
            <p className="break-words text-sm text-muted-foreground">{row.identifier} · {row.status} · {row.minutes} min ({row.percent}%)</p>
          </li>)}</ul>}
      </div>}
    </article>
  );
}

export function AttendanceHistory({ classId, live }: { classId: string; live: boolean }) {
  const sessions = useQuery({
    queryKey: ["class", classId, "sessions"],
    refetchInterval: live ? 15000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("class_sessions").select("*").eq("class_id", classId).order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return <section className="mt-8 min-w-0">
    <h2 className="text-xl font-bold sm:text-2xl">Attendance history</h2>
    <div className="mt-3 grid gap-3">
      {sessions.isPending ? <p className="text-sm text-muted-foreground">Loading attendance…</p> : sessions.isError ? <Button variant="outline" onClick={() => sessions.refetch()}>Retry attendance</Button> : !sessions.data.length ? <p className="text-sm text-muted-foreground">No live classes held yet.</p> : sessions.data.map((s) => <SessionRecord key={s.id} session={s} />)}
    </div>
  </section>;
}