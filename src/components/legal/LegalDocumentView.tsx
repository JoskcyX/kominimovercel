import { LEGAL_EFFECTIVE_DISPLAY } from "@/config/legal";
import type { Block, LegalDocument } from "@/content/legal/types";

function BlockView({ block }: { block: Block }) {
  if ("p" in block) return <p className="leading-relaxed text-foreground/90">{block.p}</p>;
  if ("ul" in block)
    return (
      <ul className="list-disc space-y-2 pl-6 leading-relaxed text-foreground/90 marker:text-primary">
        {block.ul.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if ("note" in block)
    return (
      <p className="rounded-xl border-2 border-primary/30 bg-accent/60 p-4 text-sm leading-relaxed">
        {block.note}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-border align-top">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 ${i === 0 ? "font-bold" : "text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a structured legal document with a table of contents. */
export function LegalDocumentView({ doc, version }: { doc: LegalDocument; version: string }) {
  return (
    <article className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
      <header className="pop-in py-8 text-center sm:py-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{doc.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{doc.summary}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Effective {LEGAL_EFFECTIVE_DISPLAY} · Version {version}
        </p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-6 space-y-1 text-sm">
            <p className="mb-2 font-bold">Contents</p>
            {doc.sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>
        <div className="space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 space-y-4">
              <h2 className="text-2xl font-bold">{s.title}</h2>
              {s.blocks.map((b, i) => (
                <BlockView key={i} block={b} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
