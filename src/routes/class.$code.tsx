import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Clock, FileText, Link2, PlayCircle, Radio, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getClassVideoUrl } from "@/lib/class-videos.functions";
import { getLiveStatus, joinLiveClass } from "@/lib/live.functions";
import { LiveRoom } from "@/components/LiveRoom";
import { embedUrl } from "@/lib/courses";
import { PdfPage, isPdf } from "@/components/PdfPage";

export const Route = createFileRoute("/class/$code")({
  head: () => ({
    meta: [
      { title: "Join your class — Kominimo" },
      { name: "description", content: "Request to join your tutor's class, access resources and take quizzes." },
      { property: "og:title", content: "Join your class — Kominimo" },
      { property: "og:description", content: "Request to join, get approved, and learn with your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassPage,
});

const phoneSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20).regex(/^[0-9+\-\s()]+$/, "Phone can only contain numbers"),
});
const matricSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  phone: z.string().trim().min(3, "Enter your matric number").max(40).regex(/^[A-Za-z0-9/\-_. ]+$/, "Matric number has invalid characters"),
});

type ClassInfo = { id: string; title: string; subject: string; description: string };
type Resource = { id: string; title: string; kind: "link" | "note" | "video" | "document"; url: string | null; body: string };
type ClassQuiz = { quiz_id: string; title: string; join_code: string; mode: "pop" | "async"; pushed_at: string | null; quiz_status: string; opens_at: string | null; closes_at: string | null };

function ClassPage() {
  const { code } = Route.useParams();
  const key = `edxka_class:${code.toUpperCase()}`;
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [quizzes, setQuizzes] = useState<ClassQuiz[]>([]);

  const [idLabel, setIdLabel] = useState<"phone" | "matric">("phone");
  useEffect(() => {
    setMemberId(localStorage.getItem(key));
    supabase.rpc("get_class_by_code", { _code: code.toUpperCase() }).then(({ data }) => {
      setInfo((data?.[0] as ClassInfo) ?? null);
      setLoading(false);
    });
    supabase.rpc("get_class_join_settings", { _code: code.toUpperCase() }).then(({ data }) => {
      if (data?.[0]?.id_label === "matric") setIdLabel("matric");
    });
  }, [code, key]);

  const liveFn = useServerFn(getLiveStatus);
  const joinFn = useServerFn(joinLiveClass);
  const [live, setLive] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!roomUrl || !memberId) return;
    const beat = (present: boolean) => { supabase.rpc("live_heartbeat", { _member_id: memberId, _present: present }).then(() => {}); };
    beat(true);
    const t = setInterval(() => beat(true), 15000);
    const bye = () => beat(false);
    window.addEventListener("pagehide", bye);
    return () => { clearInterval(t); window.removeEventListener("pagehide", bye); beat(false); };
  }, [roomUrl, memberId]);
  const joinLive = async () => {
    if (!memberId || !info) return;
    try {
      setRoomUrl((await joinFn({ data: { memberId } })).url);
      // Remember the session so the quiz page can keep the tutor's audio playing.
      localStorage.setItem("edxka_class_live", JSON.stringify({ classId: info.id, memberId }));
    }
    catch { toast.error("Could not join the live class"); }
  };
  const leaveLive = () => {
    setRoomUrl(null);
    localStorage.removeItem("edxka_class_live");
  };

  const refresh = useCallback(async () => {
    if (!memberId) return;
    const { data } = await supabase.rpc("get_class_membership", { _member_id: memberId });
    const row = data?.[0];
    if (!row) { localStorage.removeItem(key); setMemberId(null); return; }
    setStatus(row.status);
    if (row.status === "approved") {
      const [r, q] = await Promise.all([
        supabase.rpc("get_class_resources", { _member_id: memberId }),
        supabase.rpc("get_class_quizzes", { _member_id: memberId }),
      ]);
      setResources((r.data as Resource[]) ?? []);
      setQuizzes((q.data as ClassQuiz[]) ?? []);
      liveFn({ data: { memberId } }).then((r) => setLive(r.live)).catch(() => {});
    }
  }, [memberId, key, liveFn]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    const p = (idLabel === "matric" ? matricSchema : phoneSchema).safeParse({ name, phone });
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check your details"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("request_class_join", { _class_id: info.id, _name: p.data.name, _phone: idLabel === "matric" ? p.data.phone.toUpperCase() : p.data.phone });
    setBusy(false);
    if (error || !data) { toast.error("Could not send your request"); return; }
    localStorage.setItem(key, data as string);
    setMemberId(data as string);
    setStatus("pending"); // refreshes right away; auto-admitted students go straight in
  };

  if (loading) return <Shell><p className="text-muted-foreground">Loading class…</p></Shell>;
  if (!info) return <Shell><h1 className="text-3xl font-bold">Class not found</h1><p className="mt-2 text-muted-foreground">Check the link with your tutor.</p></Shell>;

  const now = Date.now();
  const pop = quizzes.find((q) => q.mode === "pop" && q.pushed_at && q.quiz_status !== "ended");

  return (
    <Shell>
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{info.subject || "Class"}</p>
      <h1 className="mt-1 break-words text-3xl font-bold sm:text-4xl">{info.title}</h1>
      {info.description && <p className="mt-2 text-muted-foreground">{info.description}</p>}

      {!memberId && (
        <form onSubmit={join} className="surface-card mt-8 grid gap-3 p-4 sm:p-6">
          <p className="font-bold">Request to join this class</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-12 rounded-xl border-2" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={idLabel === "matric" ? "Matric number" : "Phone number"} className="h-12 rounded-xl border-2" />
          <Button disabled={busy} className="chunky h-12 rounded-xl font-bold">Send request</Button>
        </form>
      )}

      {memberId && status === "pending" && (
        <div className="surface-card mt-8 p-8 text-center">
          <Clock className="mx-auto size-10 text-primary" />
          <p className="mt-3 text-xl font-bold">Waiting for your tutor to approve you</p>
          <p className="text-sm text-muted-foreground">Keep this page open — it updates automatically.</p>
        </div>
      )}

      {memberId && status === "rejected" && (
        <div className="surface-card mt-8 p-8 text-center">
          <p className="text-xl font-bold">Your request was declined</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={() => { localStorage.removeItem(key); setMemberId(null); setStatus(null); }}>Try again</Button>
        </div>
      )}

      {memberId && status === "approved" && (
        <div className="mt-8 grid gap-8">
          {roomUrl && <LiveRoom url={roomUrl} onLeave={() => setRoomUrl(null)} />}
          <Presentation memberId={memberId} />
          {live && (
            <Button variant="secondary" onClick={joinLive} className="surface-card grid h-auto grid-cols-[minmax(0,1fr)_auto] gap-3 whitespace-normal border-secondary bg-secondary p-4 text-left text-secondary-foreground sm:p-6">
              <div className="flex min-w-0 items-center gap-3"><Video className="size-6 shrink-0" /><div><p className="text-sm font-bold uppercase">Your class is live</p><p className="text-xl font-bold">Tap to join the video class</p></div></div>
              <PlayCircle className="size-8 shrink-0" />
            </Button>
          )}
          {pop && (
            <Link to="/join/$code" params={{ code: pop.join_code }} className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-primary bg-primary p-4 sm:p-6 text-primary-foreground">
              <div className="flex min-w-0 items-center gap-3"><Radio className="size-6 shrink-0 animate-pulse" /><div><p className="text-sm font-bold uppercase">Pop quiz now</p><p className="break-words text-lg font-bold sm:text-xl">{pop.title}</p></div></div>
              <PlayCircle className="size-8 shrink-0" />
            </Link>
          )}
          <section>
            <h2 className="text-2xl font-bold">Quizzes</h2>
            <div className="mt-3 grid gap-3">
              {quizzes.filter((q) => q.mode === "async").length === 0 && <p className="text-sm text-muted-foreground">No quizzes yet.</p>}
              {quizzes.filter((q) => q.mode === "async").map((q) => {
                const notYet = q.opens_at && new Date(q.opens_at).getTime() > now;
                const closed = q.quiz_status === "ended" || (q.closes_at && new Date(q.closes_at).getTime() <= now);
                return (
                  <div key={q.quiz_id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="break-words font-bold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.opens_at ? `Opens ${new Date(q.opens_at).toLocaleString()}` : "Open anytime"}
                        {q.closes_at ? ` · Closes ${new Date(q.closes_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                    {closed ? <span className="text-sm font-bold text-muted-foreground">Closed</span>
                      : notYet ? <span className="text-sm font-bold text-muted-foreground">Not open yet</span>
                      : <Button asChild className="rounded-full font-bold"><Link to="/join/$code" params={{ code: q.join_code }}>Take quiz</Link></Button>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-bold">Resources</h2>
            <div className="mt-3 grid gap-3">
              {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources yet.</p>}
              {resources.map((r) => (
                <div key={r.id} className="surface-card p-4">
                  <p className="flex items-center gap-2 break-words font-bold">
                    {r.kind === "video" ? <Video className="size-4 text-primary" /> : r.kind === "note" ? <FileText className="size-4 text-primary" /> : <Link2 className="size-4 text-primary" />}
                    {r.title}
                  </p>
                  {r.url && r.kind === "video" && <VideoPlayer memberId={memberId} resourceId={r.id} url={r.url} />}
                  {r.url && r.kind === "document" && <DocView memberId={memberId} resourceId={r.id} url={r.url} />}
                  {r.url && r.kind === "link" && <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-bold text-secondary underline">{r.url}</a>}
                  {r.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function useStoredUrl(memberId: string, resourceId: string | null) {
  const fetchUrl = useServerFn(getClassVideoUrl);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(null);
    if (!resourceId) return;
    fetchUrl({ data: { memberId, resourceId } }).then((r) => setSrc(r.url)).catch(() => {});
  }, [memberId, resourceId, fetchUrl]);
  return src;
}

function DocView({ memberId, resourceId, url }: { memberId: string; resourceId: string; url: string }) {
  const [open, setOpen] = useState(false);
  const src = useStoredUrl(memberId, open ? resourceId : null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  if (!open) return <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => setOpen(true)}>Open document</Button>;
  if (!src) return <p className="mt-2 text-sm text-muted-foreground">Loading…</p>;
  if (!isPdf(url)) return <a href={src} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-bold text-secondary underline">Open file</a>;
  return (
    <div className="mt-2 grid gap-2">
      <PdfPage src={src} page={page} onPageCount={setPages} />
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
        <span className="text-sm font-bold">Page {page} / {pages || "…"}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

// Follows whatever page the tutor is showing right now.
function Presentation({ memberId }: { memberId: string }) {
  const [cur, setCur] = useState<{ resource_id: string; title: string; page: number } | null>(null);
  useEffect(() => {
    const load = () => supabase.rpc("get_class_presentation", { _member_id: memberId }).then(({ data }) => {
      const row = (data as { resource_id: string; title: string; page: number }[] | null)?.[0] ?? null;
      setCur((p) => (p?.resource_id === row?.resource_id && p?.page === row?.page ? p : row));
    });
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [memberId]);
  const src = useStoredUrl(memberId, cur?.resource_id ?? null);
  if (!cur) return null;
  return (
    <section className="surface-card grid gap-2 border-primary p-4">
      <p className="flex items-center gap-2 text-sm font-bold uppercase text-primary"><span className="pulse-dot size-2 rounded-full bg-primary" /> Follow along · {cur.title} · Page {cur.page}</p>
      {src ? <PdfPage src={src} page={cur.page} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
    </section>
  );
}

function VideoPlayer({ memberId, resourceId, url }: { memberId: string; resourceId: string; url: string }) {
  const fetchUrl = useServerFn(getClassVideoUrl);
  const [src, setSrc] = useState<string | null>(null);
  const uploaded = url.startsWith("storage:");
  useEffect(() => {
    if (!uploaded) return;
    fetchUrl({ data: { memberId, resourceId } }).then((r) => setSrc(r.url)).catch(() => toast.error("Could not load video"));
  }, [uploaded, memberId, resourceId, fetchUrl]);
  if (uploaded) {
    return src ? <video src={src} controls controlsList="nodownload" className="mt-2 w-full rounded-xl" onContextMenu={(e) => e.preventDefault()} /> : <p className="mt-2 text-sm text-muted-foreground">Loading video…</p>;
  }
  const embed = embedUrl(url);
  if (embed) return <iframe src={embed} className="mt-2 aspect-video w-full rounded-xl" allowFullScreen title="Class video" />;
  return <a href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-bold text-secondary underline">{url}</a>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4 sm:px-6 sm:py-6">
        <Link to="/" className="font-display text-2xl font-bold">Kọ́mì<span className="text-primary">nímọ̀</span></Link>
        <BookOpen className="size-5 text-secondary" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">{children}</main>
    </div>
  );
}
