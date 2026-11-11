import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Link2, MonitorPlay, Plus, Square, Trash2, Upload, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addResource, deleteResource, listResources, presentResource, setResourceVisible,
} from "@/lib/classes.functions";
import { confirmUpload, createUploadUrl, getTutorFileUrl } from "@/lib/files.functions";
import { embedUrl } from "@/lib/courses";
import { PdfPage, isPdf } from "@/components/PdfPage";

type Kind = "link" | "note" | "video" | "document";
type Res = { id: string; title: string; kind: Kind; url: string | null; body: string; visible: boolean };

/** Resolves a resource to something the browser can open: plain https links as-is, uploaded files via a short-lived signed URL. */
export function useFileUrl(res: { id: string; url: string | null } | null) {
  const [src, setSrc] = useState<string | null>(null);
  const url = res?.url ?? null;
  const id = res?.id ?? null;
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    if (!url.startsWith("storage:")) { setSrc(url); return; }
    let live = true;
    getTutorFileUrl({ data: { resourceId: id! } }).then((r) => live && setSrc(r.url)).catch(() => live && setSrc(null));
    return () => { live = false; };
  }, [url, id]);
  return src;
}

function TutorView({ r }: { r: Res }) {
  const src = useFileUrl(r);
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
  return <a href={src} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-bold text-secondary underline">Open file</a>;
}

export function ClassMaterials({ classId, presentingId, presentingPage }: { classId: string; presentingId: string | null; presentingPage: number }) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["class", classId] });
  const resources = useQuery({
    queryKey: ["class", classId, "resources"],
    queryFn: async () => (await listResources({ data: { classId } })) as Res[],
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
      const name = title.trim() || file?.name || "Untitled";
      if (file && (kind === "video" || kind === "document")) {
        // 1) ask for a short-lived upload slot  2) send the bytes straight to storage  3) server verifies and records it
        const contentType = file.type || "application/octet-stream";
        const slot = await createUploadUrl({ data: { classId, filename: file.name, contentType, size: file.size } });
        const put = await fetch(slot.uploadUrl, { method: "PUT", headers: { "Content-Type": slot.contentType }, body: file });
        if (!put.ok) throw new Error("The upload didn't complete. Please try again.");
        await confirmUpload({ data: { classId, key: slot.key, title: name, visible: !hidden } });
        return;
      }
      const link = url.trim() || null;
      if (kind === "document" && !link) throw new Error("Choose a file to upload");
      if (kind === "video" && !link) throw new Error("Upload a video or paste a link");
      await addResource({ data: { classId, title: name, kind, url: link, body: body.trim(), visible: !hidden } });
    },
    onSuccess: () => { setTitle(""); setUrl(""); setBody(""); setFile(null); inv(); toast.success("Material added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await deleteResource({ data: { id } }); },
    onSuccess: () => { setDeleting(null); inv(); toast.success("Material deleted"); },
    onError: () => toast.error("Could not delete this material. Please try again."),
  });
  const toggle = useMutation({
    mutationFn: async (r: Res) => { await setResourceVisible({ data: { id: r.id, visible: !r.visible } }); },
    onSuccess: inv,
  });
  const present = useMutation({
    mutationFn: async (v: { id: string | null; page: number }) => { await presentResource({ data: { classId, resourceId: v.id, page: v.page } }); },
    onSuccess: inv,
  });

  const presenting = resources.data?.find((r) => r.id === presentingId) ?? null;
  const presentSrc = useFileUrl(presenting);
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="flex min-w-0 items-center gap-2 break-words font-bold"><MonitorPlay className="size-4 text-primary" /> Students see: {presenting.title}</p>
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
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setFile(null); }} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-2">
            <option value="document">Document / PDF</option><option value="video">Video</option><option value="link">Link</option><option value="note">Note</option>
          </select>
        </div>
        {(kind === "video" || kind === "document") && (
          <label className="flex min-w-0 cursor-pointer items-center gap-2 break-all rounded-xl border-2 border-dashed border-border p-3 text-sm font-bold">
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
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <Button variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)} className="h-auto min-w-0 justify-start whitespace-normal px-0 text-left font-bold">
                {r.kind === "video" ? <Video className="size-4 text-primary" /> : r.kind === "link" ? <Link2 className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                {r.title}
                <span className={`shrink-0 text-xs ${r.visible ? "text-secondary" : "text-muted-foreground"}`}>{r.visible ? "· visible" : "· hidden"}</span>
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {r.kind === "document" && isPdf(r.url) && (
                  <Button size="sm" variant={presentingId === r.id ? "default" : "outline"} onClick={() => present.mutate({ id: r.id, page: 1 })}><MonitorPlay className="size-4" /> Present</Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)} aria-label={`View ${r.title}`}><Eye className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => toggle.mutate(r)} aria-label={r.visible ? "Hide from students" : "Show to students"}>
                  {r.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Delete material ${r.title}`} onClick={() => setDeleting(r)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
            {open === r.id && <div className="mt-3"><TutorView r={r} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
