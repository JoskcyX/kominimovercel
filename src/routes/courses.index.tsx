import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/courses";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — Kominimo" },
      {
        name: "description",
        content: "Browse video and written courses published by Kominimo tutors, free and paid.",
      },
      { property: "og:title", content: "Courses — Kominimo" },
      { property: "og:description", content: "Video and written courses from Kominimo tutors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseCatalog,
});

function CourseCatalog() {
  const courses = useQuery({
    queryKey: ["public-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, summary, cover_url, price_cents, currency")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl font-bold">
          Komi<span className="text-primary">nimo</span>
        </Link>
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Courses</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Learn at your own pace with video and written lessons from Kominimo tutors.
        </p>

        {courses.isLoading && <p className="mt-10 text-muted-foreground">Loading courses…</p>}

        {courses.data?.length === 0 && (
          <div className="mt-10 rounded-2xl border-2 border-dashed p-10 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-bold">No courses published yet.</p>
          </div>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data?.map((course) => (
            <Link
              key={course.id}
              to="/courses/$slug"
              params={{ slug: course.slug }}
              className="chunky group flex flex-col overflow-hidden rounded-2xl border-2 bg-card"
            >
              <div className="flex h-36 items-center justify-center bg-muted">
                {course.cover_url ? (
                  <img
                    src={course.cover_url}
                    alt={`${course.title} cover`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <PlayCircle className="size-10 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-xl font-bold">{course.title}</h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{course.summary}</p>
                <span className="mt-4 font-bold text-primary">
                  {formatPrice(course.price_cents, course.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
