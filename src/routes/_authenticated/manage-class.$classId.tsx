import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { buildAttendanceXlsx, downloadBlob } from "@/lib/attendance";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Download, Eye, Plus, Radio, Trash2, X } from "lucide-react";
import { StudentPreview } from "@/components/StudentPreview";
import { ClassMaterials } from "@/components/ClassMaterials";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { endLiveClass, startLiveClass } from "@/lib/live.functions";
import { LiveRoom } from "@/components/LiveRoom";

export const Route = createFileRoute("/_authenticated/manage-class/$classId")({
  head: () => ({
    meta: [
      { title: "Class control room — Kominimo" },
      { name: "description", content: "Approve students, share resources and push quizzes to your class." },
      { property: "og:title", content: "Class control room — Kominimo" },
      { property: "og:description", content: "Manage your Kominimo class." },
    ],
  }),
  component: ClassRoom,
});

function toLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ClassRoom() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["class", classId] });

  const cls = useQuery({
    queryKey: ["class", classId, "info"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId).single();
      if (error) throw error;
      return data;
    },
  });
  const members = useQuery({
    queryKey: ["class", classId, "members"],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("class_members").select("*").eq("class_id", classId).order("joined_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const linked = useQuery({
    queryKey: ["class", classId, "quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_quizzes").select("id, mode, pushed_at, quiz_id, quizzes(id, title, join_code, status, opens_at, closes_at)").eq("class_id", classId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const myQuizzes = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title, join_code, status").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("class_members").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Student removed"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const roster = useQuery({
    queryKey: ["class", classId, "roster"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_roster").select("*").eq("class_id", classId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [rosterText, setRosterText] = useState("");
  const [rosterOn, setRosterOn] = useState(false);
  const addRoster = useMutation({
    mutationFn: async () => {
      const rows = [...new Set(rosterText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))].slice(0, 1000)
        .map((identifier) => ({ class_id: classId, identifier: identifier.slice(0, 120) }));
      const { error } = await supabase.from("class_roster").upsert(rows, { onConflict: "class_id,identifier", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => { setRosterText(""); inv(); toast.success("List saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delRoster = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_roster").delete().eq("id", id); if (error) throw error; },
    onSuccess: inv,
  });

  const [pick, setPick] = useState("");
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const addAsync = useMutation({
    mutationFn: async () => {
      if (!pick) throw new Error("Pick a quiz");
      const { error: e1 } = await supabase.from("quizzes").update({
        opens_at: opens ? new Date(opens).toISOString() : null,
        closes_at: closes ? new Date(closes).toISOString() : null,
        status: "live",
      }).eq("id", pick);
      if (e1) throw e1;
      const { error } = await supabase.from("class_quizzes").upsert({ class_id: classId, quiz_id: pick, mode: "async" }, { onConflict: "class_id,quiz_id" });
      if (error) throw error;
    },
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ["quizzes"] }); toast.success("Quiz published to class"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const push = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.rpc("push_class_quiz", { _class_id: classId, _quiz_id: quizId });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Pop quiz sent to your class!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const unpublish = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.from("quizzes").update({ status: "ended" }).eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Quiz closed"); },
  });

  const startFn = useServerFn(startLiveClass);
  const endFn = useServerFn(endLiveClass);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const goLive = useMutation({
    mutationFn: () => startFn({ data: { classId } }),
    onSuccess: (r) => { setRoomUrl(r.url); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start"),
  });
  const endLive = useMutation({
    mutationFn: () => endFn({ data: { classId } }),
    onSuccess: () => { setRoomUrl(null); inv(); toast.success("Class ended"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not end"),
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: { admit_mode?: string; id_label?: string }) => {
      const { error } = await supabase.from("classes").update(patch).eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Class settings saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const admitAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_members").update({ status: "approved" }).eq("class_id", classId).eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Everyone waiting was let in"); },
  });

  // Ping the tutor whenever a new student is waiting, wherever they are on this page (including inside the live class).
  const seenPending = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!members.data) return;
    const ids = members.data.filter((m) => m.status === "pending");
    if (seenPending.current) {
      for (const m of ids) if (!seenPending.current.has(m.id)) toast(`${m.name} wants to join the class`, { description: "Let them in from the join requests." });
    }
    seenPending.current = new Set(ids.map((m) => m.id));
  }, [members.data]);

  const [exporting, setExporting] = useState(false);

  if (cls.isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!cls.data) return <div className="p-10">Class not found.</div>;

  const idName = cls.data.id_label === "matric" ? "Matric number" : "Phone number";
  const link = typeof window !== "undefined" ? `${window.location.origin}/class/${cls.data.join_code}` : "";
  const pending = members.data?.filter((m) => m.status === "pending") ?? [];
  const approved = members.data?.filter((m) => m.status === "approved") ?? [];
  const isLive = (m: { last_seen_at: string | null; left_at: string | null }) =>
    !!m.last_seen_at && !m.left_at && Date.now() - new Date(m.last_seen_at).getTime() < 45000;
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rosterStatus = (id: string) => {
    const k = norm(id);
    const m = approved.find((x) => norm(x.name) === k || norm(x.phone) === k || (k.length >= 3 && norm(x.name).includes(k)));
    if (!m) return "absent";
    if (isLive(m)) return "present";
    if (m.left_at) return "left";
    return "joined";
  };

  const exportAttendance = async () => {
    if (!cls.data) return;
    setExporting(true);
    try {
      const memberStatus = (m: (typeof approved)[number]) => (isLive(m) ? "Present" : m.left_at ? "Left" : m.last_seen_at ? "Attended" : "Not in live class");
      const rows = approved.map((m) => ({ name: m.name, identifier: m.phone, status: memberStatus(m), joinedAt: m.joined_at, lastSeenAt: m.last_seen_at, leftAt: m.left_at }));
      // Expected students who never joined are listed as absent.
      for (const r of roster.data ?? []) {
        if (rosterStatus(r.identifier) === "absent") rows.push({ name: "", identifier: r.identifier, status: "Absent", joinedAt: null, lastSeenAt: null, leftAt: null });
      }
      const date = cls.data.live_started_at ? new Date(cls.data.live_started_at) : new Date();
      const blob = await buildAttendanceXlsx({ platform: "Kominimo", classTitle: cls.data.title, subject: cls.data.subject, classCode: cls.data.join_code, classDate: date, idLabel: idName, rows });
      const safe = cls.data.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "class";
      downloadBlob(blob, `${safe}-attendance-${date.toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Could not create the spreadsheet");
    } finally {
      setExporting(false);
    }
  };

  const liveNotices = (
    <>
      {pending.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-primary bg-card p-2 shadow-lg">
          <div className="min-w-0"><p className="truncate text-sm font-bold">{m.name} wants to join</p><p className="truncate text-xs text-muted-foreground">{m.phone}</p></div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" className="h-7 px-2" onClick={() => setStatus.mutate({ id: m.id, status: "approved" })} aria-label={`Let ${m.name} in`}><Check className="size-4" /></Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })} aria-label={`Decline ${m.name}`}><X className="size-4" /></Button>
          </div>
        </div>
      ))}
      {pending.length > 1 && <Button size="sm" onClick={() => admitAll.mutate()} className="rounded-full font-bold">Let all {pending.length} in</Button>}
    </>
  );

  return (
    <div className="min-h-screen confetti-bg">
      {roomUrl && <LiveRoom url={roomUrl} onLeave={() => setRoomUrl(null)} leaveLabel="Close" overlay={pending.length ? liveNotices : null} />}
      <main className="mx-auto max-w-5xl px-6 py-8 pb-24">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
        <h1 className="mt-3 text-4xl font-bold">{cls.data.title}</h1>
        <div className="surface-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm text-muted-foreground">Class code</p><p className="text-2xl font-bold tracking-widest">{cls.data.join_code}</p></div>
          <div className="flex flex-wrap gap-2">
          {cls.data.live_room_name ? (
            <>
              <Button onClick={() => goLive.mutate()} disabled={goLive.isPending} className="chunky rounded-full font-bold"><Radio className="size-4" /> Rejoin live</Button>
              <Button variant="outline" onClick={() => endLive.mutate()} disabled={endLive.isPending} className="rounded-full border-2 font-bold">End class</Button>
            </>
          ) : (
            <Button onClick={() => goLive.mutate()} disabled={goLive.isPending} className="chunky rounded-full font-bold"><Radio className="size-4" /> {goLive.isPending ? "Starting…" : "Start live class"}</Button>
          )}
<Button variant="outline" className="rounded-full border-2 font-bold" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
            <Copy className="size-4" /> Copy join link
          </Button>
          </div>
        </div>

        <div className="surface-card mt-4 grid gap-4 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">
            Letting students in
            <select value={cls.data.admit_mode} onChange={(e) => saveSettings.mutate({ admit_mode: e.target.value })} className="h-11 rounded-xl border-2 border-input bg-background px-3 font-normal">
              <option value="manual">I approve each student</option>
              <option value="roster">Let in students on my expected list automatically</option>
              <option value="auto">Let everyone in automatically</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Students join with
            <select value={cls.data.id_label} onChange={(e) => saveSettings.mutate({ id_label: e.target.value })} className="h-11 rounded-xl border-2 border-input bg-background px-3 font-normal">
              <option value="phone">Name and phone number</option>
              <option value="matric">Name and matric number</option>
            </select>
          </label>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">Join requests ({pending.length})</h2>
              {pending.length > 1 && <Button size="sm" onClick={() => admitAll.mutate()} className="rounded-full font-bold">Let all in</Button>}
            </div>
            <div className="mt-3 grid gap-2">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
              {pending.map((m) => (
                <div key={m.id} className="surface-card flex items-center justify-between gap-2 p-3">
                  <div><p className="font-bold">{m.name}</p><p className="text-xs text-muted-foreground">{m.phone}</p></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setStatus.mutate({ id: m.id, status: "approved" })}><Check className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })}><X className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">Roster ({approved.length}) · {approved.filter(isLive).length} in class now</h2>
              <Button size="sm" variant="outline" disabled={exporting} onClick={exportAttendance} className="rounded-full border-2 font-bold"><Download className="size-4" /> {exporting ? "Preparing…" : "Download attendance (Excel)"}</Button>
            </div>
            <div className="mt-3 grid gap-2">
              {approved.map((m) => {
                const on = isLive(m);
                const left = !on && m.left_at;
                return (
                  <div key={m.id} className="surface-card flex items-center justify-between gap-2 p-3">
                    <div>
                      <p className="flex items-center gap-2 font-bold">
                        <span className={`size-2.5 rounded-full ${on ? "bg-secondary" : left ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.phone} · {on ? "Present" : left ? `Left at ${new Date(m.left_at!).toLocaleTimeString()}` : "Not in live class"}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${m.name} from this class?`)) removeMember.mutate(m.id); }}><Trash2 className="size-4" /> Remove</Button>
                  </div>
                );
              })}
            </div>

            <div className="surface-card mt-8 flex items-center justify-between gap-3 p-4">
              <div>
                <h2 className="text-xl font-bold">Expected students</h2>
                <p className="text-sm text-muted-foreground">Track attendance against your own list of names, matric numbers or phone numbers.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={rosterOn}
                onClick={() => setRosterOn((v) => !v)}
                className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${rosterOn ? "border-secondary bg-secondary" : "border-border bg-muted"}`}
              >
                <span className={`absolute top-0.5 size-6 rounded-full bg-card shadow transition-all ${rosterOn ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            {(rosterOn || (roster.data?.length ?? 0) > 0) && (<>
            <p className="mt-4 text-sm text-muted-foreground">Paste names, matric numbers or phone numbers — one per line. They're ticked off as students come into the live class.</p>
            <div className="surface-card mt-3 grid gap-2 p-4">
              <Textarea value={rosterText} onChange={(e) => setRosterText(e.target.value)} placeholder={"Ada Obi\nMAT/2024/001\n08012345678"} rows={4} />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!rosterText.trim() || addRoster.isPending} onClick={() => addRoster.mutate()} className="rounded-full font-bold"><Plus className="size-4" /> Add to list</Button>
                <label className="cursor-pointer text-sm font-bold text-primary underline">
                  Upload .txt / .csv
                  <input type="file" accept=".txt,.csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRosterText((await f.text()).split(/[\r\n]+/).map((l) => l.split(",")[0]).join("\n")); }} />
                </label>
              </div>
            </div>
            {(roster.data?.length ?? 0) > 0 && (
              <div className="mt-3 grid gap-1">
                <p className="text-sm font-bold">{roster.data!.filter((r) => rosterStatus(r.identifier) === "present").length} of {roster.data!.length} present</p>
                {roster.data!.map((r) => {
                  const st = rosterStatus(r.identifier);
                  return (
                    <div key={r.id} className="surface-card flex items-center justify-between px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${st === "present" ? "bg-secondary" : st === "left" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        <span className="font-bold">{r.identifier}</span>
                        <span className="text-muted-foreground">{st === "present" ? "Present" : st === "left" ? "Left" : st === "joined" ? "In class, not live" : "Absent"}</span>
                      </span>
                      <button aria-label="Remove from list" onClick={() => delRoster.mutate(r.id)} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}
            </>)}
          </section>

          <section>
            <h2 className="text-2xl font-bold">Quizzes</h2>
            <div className="surface-card mt-3 grid gap-2 p-4">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 rounded-xl border-2 border-input bg-background px-3">
                <option value="">Choose one of your quizzes…</option>
                {myQuizzes.data?.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">Opens<Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
                <label className="text-xs font-bold">Closes<Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!pick} onClick={() => setPreview({ id: pick, title: myQuizzes.data?.find((q) => q.id === pick)?.title ?? "Quiz" })} variant="ghost" className="rounded-full font-bold"><Eye className="size-4" /> Preview as student</Button>
                <Button disabled={!pick || addAsync.isPending} onClick={() => addAsync.mutate()} variant="outline" className="rounded-full border-2 font-bold">Publish anytime quiz</Button>
                <Button disabled={!pick || push.isPending} onClick={() => push.mutate(pick)} className="chunky rounded-full font-bold"><Radio className="size-4" /> Push pop quiz now</Button>
              </div>
              {preview && <StudentPreview quizId={preview.id} title={preview.title} open onOpenChange={(o) => !o && setPreview(null)} />}
            </div>
            <div className="mt-3 grid gap-2">
              {linked.data?.map((l) => {
                const q = l.quizzes as unknown as { id: string; title: string; status: string; opens_at: string | null; closes_at: string | null } | null;
                if (!q) return null;
                return (
                  <div key={l.id} className="surface-card flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-bold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.mode === "pop" ? "Pop quiz" : "Anytime"} · {q.status}
                        {q.opens_at ? ` · from ${toLocalInput(q.opens_at).replace("T", " ")}` : ""}
                        {q.closes_at ? ` · until ${toLocalInput(q.closes_at).replace("T", " ")}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPreview({ id: q.id, title: q.title })}><Eye className="size-4" /> Preview</Button>
                      <Button asChild size="sm" variant="outline"><Link to="/quiz/$quizId" params={{ quizId: q.id }}>Results</Link></Button>
                      {q.status !== "ended" && <Button size="sm" variant="ghost" onClick={() => unpublish.mutate(q.id)}>Unpublish</Button>}
                    </div>
                  </div>
                );
              })}
            </div>

            <ClassMaterials classId={classId} presentingId={cls.data.presenting_resource_id ?? null} presentingPage={cls.data.presenting_page ?? 1} />
          </section>
        </div>
      </main>
    </div>
  );
}
