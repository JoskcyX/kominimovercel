import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { isRecentlyPresent } from "@/lib/live-connection";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, CalendarDays, Check, Copy, Eye, FileText, Plus, Radio, Settings, Users, X } from "lucide-react";
import { StudentPreview } from "@/components/StudentPreview";
import { ClassMaterials } from "@/components/ClassMaterials";
import { AttendanceHistory } from "@/components/AttendanceHistory";
import { ClassRepSettings } from "@/components/ClassRepSettings";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SITE } from "@/config/site";
import {
  addRoster as addRosterFn, admitAll as admitAllFn, deleteRoster, getClass, listClassQuizzes, listMembers, listRoster,
  publishAsyncQuiz, pushPopQuiz, removeMember as removeMemberFn, setMemberStatus, updateClassSettings,
} from "@/lib/classes.functions";
import { listQuizzes, quizAction } from "@/lib/quizzes.functions";
import { endLiveClass, startLiveClass } from "@/lib/live.functions";
import { LiveRoom } from "@/components/LiveRoom";

export const Route = createFileRoute("/_authenticated/manage-class/$classId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `Class control room — ${SITE.name}` },
      { name: "description", content: "Approve students, share resources and push quizzes to your class." },
      { property: "og:title", content: `Class control room — ${SITE.name}` },
      { property: "og:description", content: `Manage your ${SITE.name} class.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassRoom,
});

function toLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type FeatureKey = "quizzes" | "materials" | "rep" | "roster";
const FEATURES: { key: FeatureKey; label: string; hint: string }[] = [
  { key: "quizzes", label: "Quizzes", hint: "Push quizzes to students during class" },
  { key: "materials", label: "Materials", hint: "Share slides and files, present on screen" },
  { key: "rep", label: "Class rep", hint: "Let a student help you admit and manage the class" },
  { key: "roster", label: "Expected students list", hint: "Tick off students from your own list" },
];

function ClassRoom() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["class", classId] });
  const [section, setSection] = useState("classroom");
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({ quizzes: false, materials: false, rep: false, roster: false });
  useEffect(() => {
    try { const saved = localStorage.getItem(`kominimo:features:${classId}`); if (saved) setFeatures((f) => ({ ...f, ...JSON.parse(saved) })); } catch { /* ignore */ }
  }, [classId]);
  const toggleFeature = (k: FeatureKey, on: boolean) => {
    setFeatures((f) => { const next = { ...f, [k]: on }; try { localStorage.setItem(`kominimo:features:${classId}`, JSON.stringify(next)); } catch { /* ignore */ } return next; });
    if (!on && section === k) setSection("settings");
  };
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const cls = useQuery({
    queryKey: ["class", classId, "info"],
    queryFn: () => getClass({ data: { classId } }),
  });
  const members = useQuery({
    queryKey: ["class", classId, "members"],
    refetchInterval: 4000,
    queryFn: () => listMembers({ data: { classId } }),
  });
  const linked = useQuery({
    queryKey: ["class", classId, "quizzes"],
    queryFn: () => listClassQuizzes({ data: { classId } }),
  });
  const myQuizzes = useQuery({
    queryKey: ["quizzes"],
    queryFn: () => listQuizzes(),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => { await setMemberStatus({ data: { id, status } }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    onSuccess: inv,
  });
  const removeMember = useMutation({
    mutationFn: async (id: string) => { await removeMemberFn({ data: { id } }); },
    onSuccess: () => { setRemoving(null); inv(); toast.success("Student removed"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const roster = useQuery({
    queryKey: ["class", classId, "roster"],
    queryFn: () => listRoster({ data: { classId } }),
  });
  const [rosterText, setRosterText] = useState("");
  const [rosterOn, setRosterOn] = useState(false);
  const addRoster = useMutation({
    mutationFn: async () => {
      const identifiers = [...new Set(rosterText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))].slice(0, 1000).map((x) => x.slice(0, 120));
      if (identifiers.length === 0) throw new Error("Paste at least one name or number");
      await addRosterFn({ data: { classId, identifiers } });
    },
    onSuccess: () => { setRosterText(""); inv(); toast.success("List saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delRoster = useMutation({
    mutationFn: async (id: string) => { await deleteRoster({ data: { id } }); },
    onSuccess: inv,
  });

  const [pick, setPick] = useState("");
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const addAsync = useMutation({
    mutationFn: async () => {
      if (!pick) throw new Error("Pick a quiz");
      await publishAsyncQuiz({
        data: {
          classId,
          quizId: pick,
          opensAt: opens ? new Date(opens).toISOString() : null,
          closesAt: closes ? new Date(closes).toISOString() : null,
        },
      });
    },
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ["quizzes"] }); toast.success("Quiz published to class"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const push = useMutation({
    mutationFn: async (quizId: string) => {
      await pushPopQuiz({ data: { classId, quizId } });
    },
    onSuccess: () => { inv(); toast.success("Pop quiz sent to your class!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const unpublish = useMutation({
    mutationFn: async (quizId: string) => {
      await quizAction({ data: { quizId, action: "end" } });
    },
    onSuccess: () => { inv(); toast.success("Quiz closed"); },
  });

  const startFn = startLiveClass;
  const endFn = endLiveClass;
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
    mutationFn: async (patch: { admit_mode?: string; id_label?: string; attendance_threshold?: number }) => {
      await updateClassSettings({ data: { classId, ...(patch as { admit_mode?: "manual" | "roster" | "auto"; id_label?: "phone" | "matric"; attendance_threshold?: number }) } });
    },
    onSuccess: () => { inv(); toast.success("Class settings saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const admitAll = useMutation({
    mutationFn: async () => {
      const r = await admitAllFn({ data: { classId } });
      if (r.waiting > 0) throw new Error(`Class is full — ${r.admitted} let in, ${r.waiting} still waiting. Upgrade or remove a student to make room.`);
    },
    onSuccess: () => { inv(); toast.success("Everyone waiting was let in"); },
    onError: (e) => { inv(); toast.error(e instanceof Error ? e.message : "Failed"); },
  });

  // Ping the tutor whenever a new student is waiting, wherever they are on this page (including inside the live class).
  const seenPending = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!members.data) return;
    const ids = members.data.filter((m) => m.status === "pending");
    const repSet = !!cls.data?.rep_member_id;
    if (seenPending.current && !repSet) {
      for (const m of ids) if (!seenPending.current.has(m.id)) toast(`${m.name} wants to join the class`, { description: "Let them in from the join requests." });
    }
    seenPending.current = new Set(ids.map((m) => m.id));
  }, [members.data, cls.data?.rep_member_id]);

  if (cls.isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!cls.data) return <div className="p-10">Class not found.</div>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/class/${cls.data.join_code}` : "";
  const pending = members.data?.filter((m) => m.status === "pending") ?? [];
  const approved = members.data?.filter((m) => m.status === "approved") ?? [];
  const isLive = (m: { last_seen_at: string | null; left_at: string | null }) => isRecentlyPresent(m.last_seen_at, m.left_at);
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rosterStatus = (id: string) => {
    const k = norm(id);
    const m = approved.find((x) => norm(x.name) === k || norm(x.phone) === k || (k.length >= 3 && norm(x.name).includes(k)));
    if (!m) return "absent";
    if (isLive(m)) return "present";
    if (m.left_at) return "left";
    return "joined";
  };

  const threshold = cls.data.attendance_threshold ?? 75;

  const liveNotices = (
    <>
      {pending.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-primary bg-card p-2 shadow-lg">
          <div className="min-w-0"><p className="truncate text-sm font-bold">{m.name} wants to join</p><p className="truncate text-xs text-muted-foreground">{m.phone}</p></div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" className="h-11 w-11 px-2 sm:h-7 sm:w-auto" onClick={() => setStatus.mutate({ id: m.id, status: "approved" })} aria-label={`Let ${m.name} in`}><Check className="size-4" /></Button>
            <Button size="sm" variant="outline" className="h-11 w-11 px-2 sm:h-7 sm:w-auto" onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })} aria-label={`Decline ${m.name}`}><X className="size-4" /></Button>
          </div>
        </div>
      ))}
      {pending.length > 1 && <Button size="sm" onClick={() => admitAll.mutate()} className="rounded-full font-bold">Let all {pending.length} in</Button>}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <ConfirmAction open={!!removing} onOpenChange={(value) => { if (!value) setRemoving(null); }} title="Remove student?" description={`${removing?.name ?? "This student"} will be removed from this class and lose access to its materials.`} label="Remove student" pending={removeMember.isPending} onConfirm={() => { if (removing) removeMember.mutate(removing.id); }} />
      {roomUrl && <LiveRoom url={roomUrl} onLeave={() => setRoomUrl(null)} leaveLabel="Close" overlay={pending.length && !cls.data.rep_member_id ? liveNotices : null} />}
      <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6 sm:py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
        <h1 className="mt-3 break-words text-2xl font-bold sm:text-4xl">{cls.data.title}</h1>
        <div className="mt-4 grid gap-3 border-y border-border py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div><p className="text-sm text-muted-foreground">Class code</p><p className="text-2xl font-bold tracking-widest">{cls.data.join_code}</p></div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
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

        <Tabs value={section} onValueChange={setSection} className="mt-6">
          <TabsList aria-label="Class sections" className="flex h-auto w-full flex-wrap gap-1 rounded-lg border border-border bg-muted p-1 [&>button]:flex-1">
            <TabsTrigger value="classroom" className="min-h-11 gap-1.5 px-2"><Users className="size-4 shrink-0" /> Classroom{pending.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pending.length}</span>}</TabsTrigger>
            <TabsTrigger value="attendance" className="min-h-11 gap-1.5 px-2"><CalendarDays className="size-4 shrink-0" /> Attendance</TabsTrigger>
            {features.quizzes && <TabsTrigger value="quizzes" className="min-h-11 gap-1.5 px-2"><BookOpen className="size-4 shrink-0" /> Quizzes</TabsTrigger>}
            {features.materials && <TabsTrigger value="materials" className="min-h-11 gap-1.5 px-2"><FileText className="size-4 shrink-0" /> Materials</TabsTrigger>}
            <TabsTrigger value="settings" className="min-h-11 gap-1.5 px-2"><Settings className="size-4 shrink-0" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="classroom" forceMount className="mt-6 data-[state=inactive]:hidden">
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-4 text-sm">
              <span className="flex items-center gap-2 font-bold"><span className={`size-2 shrink-0 rounded-full ${cls.data.live_room_name ? "bg-secondary" : "bg-muted-foreground"}`} />{cls.data.live_room_name ? "Class is live" : "Not live"}</span>
              <span><strong>{approved.length}</strong> approved students</span>
              <span><strong>{approved.filter(isLive).length}</strong> in live class</span>
              {cls.data.rep_member_id && <span className="text-muted-foreground">Class rep: {approved.find((m) => m.id === cls.data.rep_member_id)?.name ?? "Assigned"}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">Join requests ({pending.length})</h2>
              {pending.length > 1 && <Button size="sm" onClick={() => admitAll.mutate()} className="rounded-full font-bold">Let all in</Button>}
            </div>
            <div className="mt-3 grid gap-2">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
              {pending.map((m) => (
                <div key={m.id} className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
                  <div className="min-w-0 break-words"><p className="font-bold">{m.name}</p><p className="text-xs text-muted-foreground">{m.phone}</p></div>
                  <div className="flex gap-2">
                    <Button size="icon" aria-label={`Let ${m.name} in`} onClick={() => setStatus.mutate({ id: m.id, status: "approved" })}><Check className="size-4" /></Button>
                    <Button size="icon" variant="outline" aria-label={`Decline ${m.name}`} onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })}><X className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setSection("settings")}><Settings className="size-4" /> More features in Settings</Button>
            </div>
          </TabsContent>
          <TabsContent value="attendance" forceMount className="mt-6 data-[state=inactive]:hidden [&>section]:mt-0">
            <AttendanceHistory classId={classId} live={!!cls.data.live_room_name} members={members.data ?? []} onRemove={setRemoving} />

          </TabsContent>
          {features.quizzes && <TabsContent value="quizzes" forceMount className="mt-6 data-[state=inactive]:hidden">
            <h2 className="text-2xl font-bold">Quizzes</h2>
            <div className="surface-card mt-3 grid gap-2 p-4">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 w-full min-w-0 max-w-full rounded-xl border-2 border-input bg-background px-3">
                <option value="">Choose one of your quizzes…</option>
                {myQuizzes.data?.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs font-bold">Opens<Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
                <label className="text-xs font-bold">Closes<Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
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
                  <div key={l.id} className="surface-card grid min-w-0 gap-3 p-3">
                    <div>
                      <p className="break-words font-bold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.mode === "pop" ? "Pop quiz" : "Anytime"} · {q.status}
                        {q.opens_at ? ` · from ${toLocalInput(q.opens_at).replace("T", " ")}` : ""}
                        {q.closes_at ? ` · until ${toLocalInput(q.closes_at).replace("T", " ")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPreview({ id: q.id, title: q.title })}><Eye className="size-4" /> Preview</Button>
                      <Button asChild size="sm" variant="outline"><Link to="/quiz/$quizId" params={{ quizId: q.id }}>Results</Link></Button>
                      {q.status !== "ended" && <Button size="sm" variant="ghost" onClick={() => unpublish.mutate(q.id)}>Unpublish</Button>}
                    </div>
                  </div>
                );
              })}
            </div>

          </TabsContent>}
          {features.materials && <TabsContent value="materials" forceMount className="mt-6 data-[state=inactive]:hidden [&_h2]:mt-0">
            <ClassMaterials classId={classId} presentingId={cls.data.presenting_resource_id ?? null} presentingPage={cls.data.presenting_page ?? 1} />
          </TabsContent>}
          <TabsContent value="settings" forceMount className="mt-6 data-[state=inactive]:hidden">
            <div className="surface-card mb-8 p-4">
              <h2 className="text-xl font-bold">Extra features</h2>
              <p className="text-sm text-muted-foreground">Turn on only what you need. Switched-on features show up on your class page.</p>
              <div className="mt-3 grid gap-2">
                {FEATURES.map((f) => (
                  <label key={f.key} className="grid min-h-11 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <span className="min-w-0"><span className="block font-bold">{f.label}</span><span className="block text-xs text-muted-foreground">{f.hint}</span></span>
                    <Switch aria-label={f.label} checked={features[f.key]} onCheckedChange={(v) => toggleFeature(f.key, v)} />
                  </label>
                ))}
              </div>
            </div>
            <h2 className="text-2xl font-bold">Class settings</h2>
        <div className="mt-4 border-b border-border grid gap-4 p-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm font-bold">
            Letting students in
            <select value={cls.data.admit_mode} onChange={(e) => saveSettings.mutate({ admit_mode: e.target.value })} className="h-11 w-full min-w-0 max-w-full rounded-xl border-2 border-input bg-background px-3 font-normal">
              <option value="manual">I approve each student</option>
              <option value="roster">Let in students on my expected list automatically</option>
              <option value="auto">Let everyone in automatically</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-bold">
            Students join with
            <select value={cls.data.id_label} onChange={(e) => saveSettings.mutate({ id_label: e.target.value })} className="h-11 w-full min-w-0 max-w-full rounded-xl border-2 border-input bg-background px-3 font-normal">
              <option value="phone">Name and phone number</option>
              <option value="matric">Name and matric number</option>
            </select>
          </label>
        </div>

            <div className="mt-8 grid gap-2 text-sm">
              <label className="flex flex-wrap items-center gap-2 font-bold">
                Count as attended after
                <select value={threshold} onChange={(e) => saveSettings.mutate({ attendance_threshold: Number(e.target.value) })} className="h-9 rounded-lg border-2 border-input bg-background px-2">
                  {[25, 50, 60, 75, 90].map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
                of the live class
              </label>
            </div>

            {(features.rep || cls.data.rep_member_id) && <ClassRepSettings classId={classId} repId={cls.data.rep_member_id} students={approved.map((m) => ({ id: m.id, name: m.name }))} />}

            {(features.roster || (roster.data?.length ?? 0) > 0) && (<>
            <div className="surface-card mt-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
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
                <p className="text-sm font-bold">{roster.data?.filter((r) => rosterStatus(r.identifier) === "present").length} of {roster.data?.length} present</p>
                {roster.data?.map((r) => {
                  const st = rosterStatus(r.identifier);
                  return (
                    <div key={r.id} className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                        <span className={`size-2.5 shrink-0 rounded-full ${st === "present" ? "bg-secondary" : st === "left" ? "bg-primary" : "bg-muted-foreground/40"}`} />
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
            </>)}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
