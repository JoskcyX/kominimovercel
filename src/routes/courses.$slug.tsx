import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, FileText, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { embedUrl, formatPrice, type Lesson } from "@/lib/courses";

export const Route = createFileRoute("/courses/$slug")({
  head: () => ({
    meta: [
      { title: "Course — EDxKa" },
      { name: "description", content: "Watch video lessons and read written material from an EDxKa tutor." },
      { property: "og:title", content: "Course — EDxKa" },
      { property: "og:description", content: "Video and written lessons on EDxKa." },
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const course = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, summary, cover_url, price_cents, currency")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const courseId = course.data?.id;

  const lessons = useQuery({
    queryKey: ["lessons", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, course_id, order_index, title, kind, video_url, body")
        .eq("course_id", courseId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const enrollment = useQuery({
    queryKey: ["enrollment", courseId, userId],
    enabled: !!courseId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("course_id", courseId!)
        .eq("student_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isPaid = (course.data?.price_cents ?? 0) > 0;
  const hasAccess = enrollment.data?.status === "free" || enrollment.data?.status === "paid";

  const enrollFree = async () => {
    if (!userId) {
      navigate({ to: "/auth" });
      return;
    }
    const { error } = await supabase
      .from("enrollments")
      .insert({ course_id: courseId!, student_id: userId, status: "free" });
    if (error) toast.error(error.message);
    else {
      toast.success("You're enrolled — enjoy the course!");
      queryClient.invalidateQueries({ queryKey: ["enrollment", courseId, userId] });
    }
  };

  const buy = () => {
    if (!userId) {
      navigate({ to: "/auth" });
      return;
    }
    toast.info("Card checkout isn't connected yet — payments need to be enabled on this project.");
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

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl font-bold">
          ED<span className="text-primary">xKa</span>
        </Link>
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/courses">All courses</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="chunky rounded-2xl border-2 bg-card p-8">
          <h1 className="font-display text-4xl font-bold">{course.data.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{course.data.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="font-display text-2xl font-bold text-primary">
              {formatPrice(course.data.price_cents, course.data.currency)}
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
                <article key={lesson.id} className="chunky rounded-2xl border-2 bg-card p-6">
                  <div className="flex items-center gap-3">
                    {lesson.kind === "video" ? (
                      <PlayCircle className="size-5 text-primary" />
                    ) : (
                      <FileText className="size-5 text-primary" />
                    )}
                    <h3 className="font-display text-lg font-bold">
                      {index + 1}. {lesson.title}
                    </h3>
                    {locked && <Lock className="ml-auto size-4 text-muted-foreground" />}
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
