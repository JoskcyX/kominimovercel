import { Link } from "@tanstack/react-router";
import { FOOTER_LINKS, SITE, operatorName } from "@/config/site";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-border px-5 py-10 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Brand className="text-xl text-foreground" />
          <p className="max-w-xs">{SITE.description}</p>
        </div>
        {Object.entries(FOOTER_LINKS).map(([group, links]) => (
          <nav key={group} aria-label={group}>
            <p className="font-bold text-foreground">{group}</p>
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {operatorName()}. All rights reserved.
      </div>
    </footer>
  );
}
