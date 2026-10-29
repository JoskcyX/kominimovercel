import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, slugify } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/my-courses")({
  head: () => ({
    meta: [
      { title: "My courses — EDxKa" },
      { name: "description", content: "Create and publish video or written courses for your students." },
      { property: "og:title", content: "My courses — EDxKa" },
      { property: "og:description", content: "Create and publish courses on EDxKa." },
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, price_cents, currency, is_published, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createCourse = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const tutorId = userData.user?.id;
      if (!tutorId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("courses")
        .insert({ title: name, slug: slugify(name), tutor_id: tutorId })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      navigate({ to: "/course/$courseId", params: { courseId: data.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Button asChild variant="ghost" className="font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>

        <h1 className="mt-4 font-display text-4xl font-bold">My courses</h1>

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
              className="chunky flex items-center justify-between rounded-2xl border-2 bg-card p-5"
            >
              <div>
                <p className="font-display text-lg font-bold">{course.title}</p>
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
