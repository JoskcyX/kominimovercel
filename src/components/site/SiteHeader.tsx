import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NAV_LINKS } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Brand } from "./Brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-30 mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-8">
      <Brand />
      <nav
        className="hidden items-center gap-7 text-sm font-bold md:flex"
        aria-label="Main navigation"
      >
        {NAV_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="transition-colors hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="outline"
          className="chunky h-10 shrink-0 rounded-full border-2 px-4 text-sm font-bold sm:h-11 sm:px-5 sm:text-base"
        >
          <Link to="/auth">Tutor sign in</Link>
        </Button>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full border-2 border-border md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav
          className="surface-card absolute inset-x-4 top-16 z-40 flex flex-col gap-1 p-3 md:hidden"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-bold hover:bg-accent"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-3 text-base font-bold hover:bg-accent"
          >
            Contact us
          </Link>
        </nav>
      )}
    </header>
  );
}
