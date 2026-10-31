import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Link2, MonitorPlay, Plus, Square, Trash2, Upload, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { embedUrl } from "@/lib/courses";
import { PdfPage, isPdf } from "@/components/PdfPage";

type Kind = "link" | "note" | "video" | "document";
type Res = { id: string; title: string; kind: Kind; url: string | null; body: string; visible: boolean };

const BUCKET = "class-videos";

export function useFileUrl(url: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url?.startsWith("storage:")) { setSrc(url); return; }
    supabase.storage.from(BUCKET).createSignedUrl(url.slice(8), 60 * 60 * 3).then(({ data }) => setSrc(data?.signedUrl ?? null));
  }, [url]);
  return src;
}

function TutorView({ r }: { r: Res }) {
  const src = useFileUrl(r.url);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  if (r.kind === "note") return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>;
  if (!src) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (r.kind === "video") {
    if (r.url?.startsWith("storage:")) return <video src={src} controls className="w-full rounded-xl" />;
    const e = embedUrl(src);
    return e ? <iframe src={e} className="aspect-video w-full rounded-xl" allowFullScreen title={r.title} /> : null;
  }
  if (r.kind === "document" && isPdf(r.url)) {
    return (
      <div className="grid gap-2">
        <PdfPage src={src} page={page} onPageCount={setPages} />
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-bold">Page {page} / {pages || "…"}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    );
  }
  return <a href={src} target="_blank" rel="noreferrer" className="break-all text-sm font-bold text-secondary underline">Open file</a>;
}

export function ClassMaterials({ classId, presentingId, presentingPage }: { classId: string; presentingId: string | null; presentingPage: number }) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["class", classId] });
  const resources = useQuery({
    queryKey: ["class", classId, "resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_resources").select("*").eq("class_id", classId).order("order_index");
      if (error) throw error;
      return data as Res[];
    },
  });

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("document");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Res | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      let u = url.trim() || null;
      if (file && (kind === "video" || kind === "document")) {
        if (file.size > 1024 * 1024 * 1024) throw new Error("File is over 1GB");
        const path = `${classId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (error) throw error;
        u = `storage:${path}`;
      }
      if (kind === "document" && !u) throw new Error("Choose a file to upload");
      if (kind === "video" && !u) throw new Error("Upload a video or paste a link");
      const { error } = await supabase.from("class_resources").insert({
        class_id: classId, title: title.trim() || file?.name || "Untitled", kind, url: u, body: body.trim(),
        order_index: resources.data?.length ?? 0, visible: !hidden,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setUrl(""); setBody(""); setFile(null); inv(); toast.success("Material added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_resources").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { setDeleting(null); inv(); toast.success("Material deleted"); },
    onError: () => toast.error("Could not delete this material. Please try again."),
  });
  const toggle = useMutation({
    mutationFn: async (r: Res) => { const { error } = await supabase.from("class_resources").update({ visible: !r.visible }).eq("id", r.id); if (error) throw error; },
    onSuccess: inv,
  });
  const present = useMutation({
    mutationFn: async (v: { id: string | null; page: number }) => {
      const { error } = await supabase.from("classes").update({ presenting_resource_id: v.id, presenting_page: v.page }).eq("id", classId);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const presenting = resources.data?.find((r) => r.id === presentingId) ?? null;
  const presentSrc = useFileUrl(presenting?.url ?? null);
  const [pages, setPages] = useState(0);
  const go = (p: number) => present.mutate({ id: presentingId, page: Math.max(1, pages ? Math.min(p, pages) : p) });

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") go(presentingPage + 1);
      if (e.key === "ArrowLeft") go(presentingPage - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const accept = kind === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

  return (
    <div>
      <ConfirmAction open={!!deleting} onOpenChange={(value) => { if (!value) setDeleting(null); }} title="Delete material?" description={`“${deleting?.title ?? ""}” will be removed from this class. This cannot be undone.`} pending={del.isPending} onConfirm={() => { if (deleting) del.mutate(deleting.id); }} />
      <h2 className="mt-8 text-2xl font-bold">Materials</h2>

      {presenting && (
        <div className="surface-card mt-3 grid gap-3 border-primary p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-bold"><MonitorPlay className="size-4 text-primary" /> Students see: {presenting.title}</p>
            <Button size="sm" variant="outline" onClick={() => present.mutate({ id: null, page: 1 })}><Square className="size-4" /> Stop</Button>
          </div>
          {presentSrc && isPdf(presenting.url) ? <PdfPage src={presentSrc} page={presentingPage} onPageCount={setPages} /> : <TutorView r={presenting} />}
          {isPdf(presenting.url) && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" disabled={presentingPage <= 1} onClick={() => go(presentingPage - 1)}><ChevronLeft className="size-4" /> Prev</Button>
              <span className="font-bold">Page {presentingPage} / {pages || "…"}</span>
              <Button disabled={!!pages && presentingPage >= pages} onClick={() => go(presentingPage + 1)}>Next <ChevronRight className="size-4" /></Button>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Tip: use your keyboard ← → arrows to turn pages.</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="surface-card mt-3 grid gap-2 p-4">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setFile(null); }} className="rounded-md border border-input bg-background px-2">
            <option value="document">Document / PDF</option><option value="video">Video</option><option value="link">Link</option><option value="note">Note</option>
          </select>
        </div>
        {(kind === "video" || kind === "document") && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-border p-3 text-sm font-bold">
            <Upload className="size-4 text-primary" />
            {file ? file.name : kind === "video" ? "Upload a video from your device" : "Upload a PDF or document from your device"}
            <input type="file" accept={accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {(kind === "link" || (kind === "video" && !file)) && <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === "video" ? "…or paste a YouTube/Vimeo link" : "https://…"} />}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notes (optional)" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Keep hidden from students for now</label>
        <Button disabled={add.isPending} className="rounded-full font-bold"><Plus className="size-4" /> {add.isPending ? "Uploading…" : "Add material"}</Button>
      </form>

      <div className="mt-3 grid gap-2">
        {resources.data?.map((r) => (
          <div key={r.id} className="surface-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex items-center gap-2 text-left font-bold">
                {r.kind === "video" ? <Video className="size-4 text-primary" /> : r.kind === "link" ? <Link2 className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                {r.title}
                <span className={`text-xs ${r.visible ? "text-secondary" : "text-muted-foreground"}`}>{r.visible ? "· visible" : "· hidden"}</span>
              </button>
              <div className="flex gap-1">
                {r.kind === "document" && isPdf(r.url) && (
                  <Button size="sm" variant={presentingId === r.id ? "default" : "outline"} onClick={() => present.mutate({ id: r.id, page: 1 })}><MonitorPlay className="size-4" /> Present</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)} aria-label="View">View</Button>
                <Button size="sm" variant="ghost" onClick={() => toggle.mutate(r)} aria-label={r.visible ? "Hide from students" : "Show to students"}>
                  {r.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Delete material ${r.title}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
            {open === r.id && <div className="mt-3"><TutorView r={r} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
