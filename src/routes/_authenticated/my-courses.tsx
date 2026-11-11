import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE } from "@/config/site";
import { formatPrice } from "@/lib/courses";
import { createCourse as createCourseFn, listMyCourses } from "@/lib/courses.functions";

export const Route = createFileRoute("/_authenticated/my-courses")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: `My courses — ${SITE.name}` },
      { name: "description", content: "Create and publish video or written courses for your students." },
      { property: "og:title", content: `My courses — ${SITE.name}` },
      { property: "og:description", content: `Create and publish courses on ${SITE.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorCourses,
});

function TutorCourses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const courses = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => listMyCourses(),
  });

  const createCourse = useMutation({
    mutationFn: (name: string) => createCourseFn({ data: { title: name } }),
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      navigate({ to: "/course/$courseId", params: { courseId: data.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-10">
        <Button asChild variant="ghost" className="font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>

        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">My courses</h1>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const name = title.trim();
            if (name.length < 3) return;
            createCourse.mutate(name);
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Course title"
            className="chunky h-12 rounded-xl border-2 font-bold"
          />
          <Button type="submit" disabled={createCourse.isPending} className="chunky h-12 rounded-xl font-bold">
            <Plus className="size-4" /> New course
          </Button>
        </form>

        <div className="mt-8 space-y-3">
          {courses.data?.length === 0 && (
            <p className="text-muted-foreground">No courses yet — create your first one above.</p>
          )}
          {courses.data?.map((course) => (
            <Link
              key={course.id}
              to="/course/$courseId"
              params={{ courseId: course.id }}
              className="chunky grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 bg-card p-4 sm:p-5"
            >
              <div>
                <p className="break-words font-display text-lg font-bold">{course.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(course.price_cents, course.currency)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  course.is_published
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {course.is_published ? "Published" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
