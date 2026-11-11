import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, FileText, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Brand } from "@/components/site/Brand";
import { SITE } from "@/config/site";
import { embedUrl, formatPrice } from "@/lib/courses";
import { enrollInCourse, getCourseBySlug } from "@/lib/courses.functions";
import { getSessionUser } from "@/lib/auth-client";

export const Route = createFileRoute("/courses/$slug")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `Course — ${SITE.name}` },
      { name: "description", content: "Watch video lessons and read written material from a tutor." },
      { property: "og:title", content: `Course — ${SITE.name}` },
      { property: "og:description", content: `Video and written lessons on ${SITE.name}.` },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The server returns the course, its lessons (paid content withheld until enrolled) and your enrolment in one call.
  const course = useQuery({
    queryKey: ["course", slug],
    queryFn: () => getCourseBySlug({ data: { slug } }),
  });
  const lessons = { data: course.data?.lessons };
  const enrollment = { data: course.data?.enrollment ?? null };
  const courseId = course.data?.course.id;

  const isPaid = (course.data?.course.price_cents ?? 0) > 0;
  const hasAccess = enrollment.data?.status === "free" || enrollment.data?.status === "paid";

  const enrollFree = async () => {
    const user = await getSessionUser().catch(() => null);
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    try {
      await enrollInCourse({ data: { courseId: courseId! } });
      toast.success("You're enrolled — enjoy the course!");
      queryClient.invalidateQueries({ queryKey: ["course", slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enrol");
    }
  };

  const buy = async () => {
    const user = await getSessionUser().catch(() => null);
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    toast.info("Card checkout isn't available yet. Contact us and we'll help you get access.");
  };

  if (course.isLoading) {
    return <div className="min-h-screen confetti-bg p-10 text-muted-foreground">Loading course…</div>;
  }

  if (!course.data) {
    return (
      <div className="min-h-screen confetti-bg p-10">
        <p className="font-display text-2xl font-bold">Course not found.</p>
        <Button asChild className="chunky mt-4 rounded-xl font-bold">
          <Link to="/courses">Browse courses</Link>
        </Button>
      </div>
    );
  }

  const data = course.data.course;
  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Brand className="text-2xl" />
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/courses">All courses</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="chunky rounded-2xl border-2 bg-card p-4 sm:p-8">
          <h1 className="break-words font-display text-3xl font-bold sm:text-4xl">{data.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{data.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="font-display text-2xl font-bold text-primary">
              {formatPrice(data.price_cents, data.currency)}
            </span>
            {hasAccess ? (
              <span className="flex items-center gap-2 font-bold text-secondary-foreground">
                <CheckCircle2 className="size-5" /> You have access
              </span>
            ) : isPaid ? (
              <Button onClick={buy} className="chunky rounded-xl font-bold">
                <CreditCard className="size-4" /> Buy this course
              </Button>
            ) : (
              <Button onClick={enrollFree} className="chunky rounded-xl font-bold">
                Enrol for free
              </Button>
            )}
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Lessons</h2>
          <div className="mt-4 space-y-4">
            {lessons.data?.length === 0 && (
              <p className="text-muted-foreground">The tutor hasn't added lessons yet.</p>
            )}
            {lessons.data?.map((lesson, index) => {
              const locked = isPaid && !hasAccess;
              const video = lesson.video_url ? embedUrl(lesson.video_url) : null;
              return (
                <article key={lesson.id} className="chunky rounded-2xl border-2 bg-card p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    {lesson.kind === "video" ? (
                      <PlayCircle className="size-5 shrink-0 text-primary" />
                    ) : (
                      <FileText className="size-5 shrink-0 text-primary" />
                    )}
                    <h3 className="min-w-0 break-words font-display text-lg font-bold">
                      {index + 1}. {lesson.title}
                    </h3>
                    {locked && <Lock className="ml-auto size-4 shrink-0 text-muted-foreground" />}
                  </div>

                  {locked ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Buy the course to unlock this lesson.
                    </p>
                  ) : lesson.kind === "video" ? (
                    video ? (
                      <div className="mt-4 aspect-video overflow-hidden rounded-xl border-2">
                        <iframe
                          src={video}
                          title={lesson.title}
                          allowFullScreen
                          loading="lazy"
                          className="size-full"
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Video link missing.</p>
                    )
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{lesson.body}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
