import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header + footer shared by every public page. */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Standard page heading block for simple public pages. */
export function PageHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="pop-in mx-auto max-w-3xl px-5 pb-8 pt-8 text-center sm:px-8 sm:pt-14">
      {eyebrow && (
        <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground sm:text-sm">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 text-lg text-muted-foreground">{intro}</p>}
    </div>
  );
}
