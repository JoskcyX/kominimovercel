export type LessonKind = "video" | "text";

export type Course = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string;
  summary: string;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  is_published: boolean;
  created_at: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  order_index: number;
  title: string;
  kind: LessonKind;
  video_url: string | null;
  body: string;
};

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "course"}-${suffix}`;
}

export function formatPrice(cents: number, currency: string): string {
  if (cents <= 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/**
 * Turns a pasted video link into an embeddable URL — but ONLY for hosts we trust, and only over
 * https. Anything else returns null (the UI then shows nothing rather than loading an arbitrary
 * page, or a `javascript:` URL, inside an iframe).
 */
export function embedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    const ytId = /^[A-Za-z0-9_-]{6,15}$/;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id && ytId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return ytId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.slice(1);
      return /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "loom.com") {
      const m = /^\/share\/([a-f0-9]{32})$/.exec(url.pathname);
      return m ? `https://www.loom.com/embed/${m[1]}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
