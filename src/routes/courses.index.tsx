import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/site/MarketingLayout";
import { SITE } from "@/config/site";
import { listPublishedCourses } from "@/lib/courses.functions";
import { formatPrice } from "@/lib/courses";

export const Route = createFileRoute("/courses/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Courses — ${SITE.name}` },
      {
        name: "description",
        content: `Browse video and written courses published by ${SITE.name} tutors, free and paid.`,
      },
      { property: "og:title", content: `Courses — ${SITE.name}` },
      { property: "og:description", content: `Video and written courses from ${SITE.name} tutors.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseCatalog,
});

function CourseCatalog() {
  const courses = useQuery({
    queryKey: ["public-courses"],
    queryFn: () => listPublishedCourses(),
  });

  return (
    <MarketingLayout>
    <div className="confetti-bg">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Courses</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Learn at your own pace with video and written lessons from {SITE.name} tutors.
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
      </div>
    </div>
    </MarketingLayout>
  );
}
