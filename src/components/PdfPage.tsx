import { useEffect, useRef, useState } from "react";

// Renders one page of a PDF. pdfjs is loaded only in the browser.
export function PdfPage({ src, page, onPageCount }: { src: string; page: number; onPageCount?: (n: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<{ src: string; doc: any } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task: any;
    (async () => {
      try {
        setLoading(true);
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        if (docRef.current?.src !== src) {
          docRef.current = { src, doc: await pdfjs.getDocument({ url: src }).promise };
        }
        const doc = docRef.current.doc;
        onPageCount?.(doc.numPages);
        const p = await doc.getPage(Math.min(Math.max(page, 1), doc.numPages));
        if (cancelled || !canvas.current) return;
        const width = canvas.current.parentElement?.clientWidth || 800;
        const base = p.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const vp = p.getViewport({ scale: (width / base.width) * dpr });
        const c = canvas.current;
        c.width = vp.width;
        c.height = vp.height;
        c.style.width = "100%";
        task = p.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c });
        await task.promise;
        if (!cancelled) { setErr(null); setLoading(false); }
      } catch (e: any) {
        if (!cancelled && e?.name !== "RenderingCancelledException") { setErr("Could not open this document"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; task?.cancel?.(); };
  }, [src, page, onPageCount]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border-2 border-border bg-card">
      {err ? <p className="p-6 text-sm text-muted-foreground">{err}</p> : <canvas ref={canvas} className="block" />}
      {loading && !err && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading page…</p>}
    </div>
  );
}

export const isPdf = (url: string | null | undefined) => !!url && /\.pdf$/i.test(url);
