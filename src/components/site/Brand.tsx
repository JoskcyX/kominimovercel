import { Link } from "@tanstack/react-router";
import { SITE } from "@/config/site";

/** The Kominimo wordmark. Change the name/styling once, in src/config/site.ts. */
export function Brand({
  className = "text-2xl sm:text-3xl",
  asLink = true,
}: {
  className?: string;
  asLink?: boolean;
}) {
  const mark = (
    <>
      {SITE.wordmark[0]}
      <span className="text-primary">{SITE.wordmark[1]}</span>
    </>
  );
  const cls = `font-display font-bold ${className}`;
  return asLink ? (
    <Link to="/" className={cls} aria-label={`${SITE.name} home`}>
      {mark}
    </Link>
  ) : (
    <span className={cls}>{mark}</span>
  );
}
