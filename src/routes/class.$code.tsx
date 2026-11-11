import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Clock, FileText, Link2, PlayCircle, Radio, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { Brand } from "@/components/site/Brand";
import { SITE } from "@/config/site";
import { joinLiveClass } from "@/lib/live.functions";
import { getClassPublic, getMemberFileUrl, getMemberHome, getPresentation, heartbeat, requestJoin } from "@/lib/member.functions";
import { LiveRoom } from "@/components/LiveRoom";
import { RepJoinNotices, RepPanel, useRepMembers } from "@/components/RepPanel";
import { embedUrl } from "@/lib/courses";
import { PdfPage, isPdf } from "@/components/PdfPage";

export const Route = createFileRoute("/class/$code")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `Join your class — ${SITE.name}` },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Request to join your tutor's class, access resources and take quizzes." },
      { property: "og:title", content: `Join your class — ${SITE.name}` },
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

type ClassInfo = { id: string; title: string; subject: string; description: string; id_label: "phone" | "matric" };
type Resource = { id: string; title: string; kind: "link" | "note" | "video" | "document"; url: string | null; body: string };
type ClassQuiz = { quiz_id: string; title: string; join_code: string; mode: "pop" | "async"; pushed_at: string | null; quiz_status: string; opens_at: string | null; closes_at: string | null };

function ClassPage() {
  const { code } = Route.useParams();
  // Holds the signed session token the server issued when this student joined (not a bare id).
  const key = `kominimo.class.${code.toUpperCase()}`;
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [quizzes, setQuizzes] = useState<ClassQuiz[]>([]);
  const [isRep, setIsRep] = useState(false);

  const rep = useRepMembers(status === "approved" && isRep ? token : null);
  const idLabel = info?.id_label ?? "phone";
  useEffect(() => {
    try { setToken(localStorage.getItem(key)); } catch { /* storage blocked */ }
    getClassPublic({ data: { code: code.toUpperCase() } })
      .then((data) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [code, key]);

  const [live, setLive] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Attendance heartbeat: while connected to the live room, tell the server every 15 s.
  useEffect(() => {
    if (!roomUrl || !token || !connected) return;
    const beat = (present: boolean) => { void heartbeat({ data: { token, present } }).catch(() => undefined); };
    beat(true);
    const t = setInterval(() => beat(true), 15000);
    const bye = (event: PageTransitionEvent) => { if (!event.persisted) beat(false); };
    window.addEventListener("pagehide", bye);
    return () => { clearInterval(t); window.removeEventListener("pagehide", bye); };
  }, [roomUrl, token, connected]);
  const joinLive = async () => {
    if (!token) return;
    try {
      setRoomUrl((await joinLiveClass({ data: { token } })).url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join the live class");
    }
  };
  const leaveLive = () => {
    if (token) void heartbeat({ data: { token, present: false } }).catch(() => undefined);
    setConnected(false);
    setRoomUrl(null);
  };

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const home = await getMemberHome({ data: { token } });
      if (!home) { localStorage.removeItem(key); setToken(null); setMemberId(null); setStatus(null); return; }
      setMemberId(home.memberId);
      setStatus(home.membership.status);
      setIsRep(home.isRep);
      setResources(home.resources as Resource[]);
      setQuizzes(home.quizzes as ClassQuiz[]);
      setLive(home.live);
    } catch (e) {
      // An expired token means "join again"; anything else is a network blip — keep what we have.
      if (e instanceof Error && /expired/i.test(e.message)) { localStorage.removeItem(key); setToken(null); setStatus(null); }
    }
  }, [token, key]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    const p = (idLabel === "matric" ? matricSchema : phoneSchema).safeParse({ name, phone });
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check your details"); return; }
    if (!agreed) { toast.error("Please accept the Terms of Use and Privacy Policy to continue."); return; }
    setBusy(true);
    try {
      const r = await requestJoin({ data: { classId: info.id, name: p.data.name, identifier: idLabel === "matric" ? p.data.phone.toUpperCase() : p.data.phone, consent: true } });
      localStorage.setItem(key, r.token);
      setToken(r.token);
      setMemberId(r.memberId);
      setStatus(r.status); // auto-admitted students go straight in
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your request");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Shell><p className="text-muted-foreground">Loading class…</p></Shell>;
  if (!info) return <Shell><h1 className="text-3xl font-bold">Class not found</h1><p className="mt-2 text-muted-foreground">Check the link with your tutor.</p></Shell>;

  const now = Date.now();
  const joined = Boolean(token);
  const pop = quizzes.find((q) => q.mode === "pop" && q.pushed_at && q.quiz_status !== "ended");

  return (
    <Shell>
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{info.subject || "Class"}</p>
      <h1 className="mt-1 break-words text-3xl font-bold sm:text-4xl">{info.title}</h1>
      {info.description && <p className="mt-2 text-muted-foreground">{info.description}</p>}

      {!joined && (
        <form onSubmit={join} className="surface-card mt-8 grid gap-3 p-4 sm:p-6">
          <p className="font-bold">Request to join this class</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-12 rounded-xl border-2" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={idLabel === "matric" ? "Matric number" : "Phone number"} className="h-12 rounded-xl border-2" />
          <ConsentCheckbox id="class-consent" checked={agreed} onChange={setAgreed} audience="student" />
          <Button disabled={busy || !agreed} className="chunky h-12 rounded-xl font-bold">Send request</Button>
        </form>
      )}

      {joined && status === "pending" && (
        <div className="surface-card mt-8 p-8 text-center">
          <Clock className="mx-auto size-10 text-primary" />
          <p className="mt-3 text-xl font-bold">Waiting for your tutor to approve you</p>
          <p className="text-sm text-muted-foreground">Keep this page open — it updates automatically.</p>
        </div>
      )}

      {joined && status === "rejected" && (
        <div className="surface-card mt-8 p-8 text-center">
          <p className="text-xl font-bold">Your request was declined</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={() => { localStorage.removeItem(key); setToken(null); setMemberId(null); setStatus(null); }}>Try again</Button>
        </div>
      )}

      {joined && token && status === "approved" && (
        <div className="mt-8 grid gap-8">
          {roomUrl && <LiveRoom url={roomUrl} onLeave={leaveLive} onConnectionChange={setConnected} overlay={rep.members ? <RepJoinNotices token={token} members={rep.members} reload={rep.reload} /> : null} />}
          {rep.members && memberId && <RepPanel token={token} selfId={memberId} members={rep.members} reload={rep.reload} />}
          <Presentation token={token} />
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
                  {r.url && r.kind === "video" && <VideoPlayer token={token} resourceId={r.id} url={r.url} />}
                  {r.url && r.kind === "document" && <DocView token={token} resourceId={r.id} url={r.url} />}
                  {r.url && r.kind === "link" && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm font-bold text-secondary underline">{r.url}</a>}
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

function useStoredUrl(token: string, resourceId: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(null);
    if (!resourceId) return;
    getMemberFileUrl({ data: { token, resourceId } }).then((r) => setSrc(r.url)).catch(() => undefined);
  }, [token, resourceId]);
  return src;
}

function DocView({ token, resourceId, url }: { token: string; resourceId: string; url: string }) {
  const [open, setOpen] = useState(false);
  const src = useStoredUrl(token, open ? resourceId : null);
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
function Presentation({ token }: { token: string }) {
  const [cur, setCur] = useState<{ resource_id: string; title: string | null; page: number } | null>(null);
  useEffect(() => {
    const load = () => getPresentation({ data: { token } }).then((row) => {
      setCur((p) => (p?.resource_id === row?.resource_id && p?.page === row?.page ? p : row));
    }).catch(() => undefined);
    void load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [token]);
  const src = useStoredUrl(token, cur?.resource_id ?? null);
  if (!cur) return null;
  return (
    <section className="surface-card grid gap-2 border-primary p-4">
      <p className="flex items-center gap-2 text-sm font-bold uppercase text-primary"><span className="pulse-dot size-2 rounded-full bg-primary" /> Follow along · {cur.title ?? "Slides"} · Page {cur.page}</p>
      {src ? <PdfPage src={src} page={cur.page} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
    </section>
  );
}

function VideoPlayer({ token, resourceId, url }: { token: string; resourceId: string; url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const uploaded = url.startsWith("storage:");
  useEffect(() => {
    if (!uploaded) return;
    getMemberFileUrl({ data: { token, resourceId } }).then((r) => setSrc(r.url)).catch(() => toast.error("Could not load video"));
  }, [uploaded, token, resourceId]);
  if (uploaded) {
    return src ? <video src={src} controls controlsList="nodownload" className="mt-2 w-full rounded-xl" onContextMenu={(e) => e.preventDefault()} /> : <p className="mt-2 text-sm text-muted-foreground">Loading video…</p>;
  }
  const embed = embedUrl(url);
  if (embed) return <iframe src={embed} className="mt-2 aspect-video w-full rounded-xl" allowFullScreen title="Class video" />;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm font-bold text-secondary underline">{url}</a>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4 sm:px-6 sm:py-6">
        <Brand className="text-2xl" />
        <BookOpen className="size-5 text-secondary" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">{children}</main>
    </div>
  );
}
