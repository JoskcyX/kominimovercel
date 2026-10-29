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

export function embedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtu.be") return `https://www.youtube.com/embed${url.pathname}`;
    if (host === "vimeo.com") return `https://player.vimeo.com/video${url.pathname}`;
    return raw;
  } catch {
    return null;
  }
}
