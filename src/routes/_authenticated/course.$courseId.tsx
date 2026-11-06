import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, type Lesson, type LessonKind } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Edit course — Kominimo" },
      { name: "description", content: "Edit course details, pricing and lessons." },
      { property: "og:title", content: "Edit course — Kominimo" },
      { property: "og:description", content: "Edit course details, pricing and lessons on Kominimo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseEditor,
});

const CURRENCIES = ["USD", "NGN", "GBP", "EUR"];

function CourseEditor() {
  const { courseId } = Route.useParams();
  const queryClient = useQueryClient();

  const course = useQuery({
    queryKey: ["my-course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, summary, cover_url, price_cents, currency, is_published")
        .eq("id", courseId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const lessons = useQuery({
    queryKey: ["my-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, course_id, order_index, title, kind, video_url, body")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [cover, setCover] = useState("");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    if (!course.data) return;
    setTitle(course.data.title);
    setSummary(course.data.summary);
    setCover(course.data.cover_url ?? "");
    setPrice((course.data.price_cents / 100).toFixed(2));
    setCurrency(course.data.currency);
  }, [course.data]);

  const saveDetails = async () => {
    const cents = Math.max(0, Math.round(Number(price) * 100) || 0);
    const { error } = await supabase
      .from("courses")
      .update({
        title: title.trim() || "Untitled course",
        summary: summary.trim(),
        cover_url: cover.trim() || null,
        price_cents: cents,
        currency,
      })
      .eq("id", courseId);
    if (error) toast.error(error.message);
    else {
      toast.success("Course saved");
      queryClient.invalidateQueries({ queryKey: ["my-course", courseId] });
    }
  };

  const togglePublish = async () => {
    const next = !course.data?.is_published;
    const { error } = await supabase.from("courses").update({ is_published: next }).eq("id", courseId);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? "Course published" : "Course unpublished");
      queryClient.invalidateQueries({ queryKey: ["my-course", courseId] });
    }
  };

  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<LessonKind>("video");
  const [newVideo, setNewVideo] = useState("");
  const [newBody, setNewBody] = useState("");

  const addLesson = async () => {
    if (newTitle.trim().length < 2) return;
    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      order_index: (lessons.data?.length ?? 0) + 1,
      title: newTitle.trim(),
      kind: newKind,
      video_url: newKind === "video" ? newVideo.trim() || null : null,
      body: newKind === "text" ? newBody.trim() : "",
    });
    if (error) toast.error(error.message);
    else {
      setNewTitle("");
      setNewVideo("");
      setNewBody("");
      queryClient.invalidateQueries({ queryKey: ["my-lessons", courseId] });
    }
  };

  const removeLesson = async (id: string) => {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["my-lessons", courseId] });
  };

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-10">
        <Button asChild variant="ghost" className="font-bold">
          <Link to="/my-courses">
            <ArrowLeft className="size-4" /> My courses
          </Link>
        </Button>

        <section className="chunky mt-4 rounded-2xl border-2 bg-card p-4 sm:p-6">
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <h1 className="font-display text-3xl font-bold">Course details</h1>
            <div className="flex flex-wrap items-center gap-2">
              {course.data?.is_published && (
                <Button asChild variant="outline" className="chunky rounded-xl border-2 font-bold">
                  <Link to="/courses/$slug" params={{ slug: course.data.slug }}>
                    <ExternalLink className="size-4" /> View page
                  </Link>
                </Button>
              )}
              <Button onClick={togglePublish} className="chunky rounded-xl font-bold">
                {course.data?.is_published ? "Unpublish" : "Publish"}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Course title"
              className="chunky h-12 rounded-xl border-2 font-bold"
            />
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="What will students learn?"
              className="chunky min-h-24 rounded-xl border-2"
            />
            <Input
              value={cover}
              onChange={(event) => setCover(event.target.value)}
              placeholder="Cover image URL (optional)"
              className="chunky h-12 rounded-xl border-2"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:flex-wrap">
              <Input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="chunky h-12 w-full min-w-0 sm:w-40 rounded-xl border-2 font-bold"
              />
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                aria-label="Currency"
                className="chunky h-12 rounded-xl border-2 bg-background px-4 font-bold"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <Button onClick={saveDetails} className="chunky h-12 rounded-xl font-bold">
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Set 0 for a free course. Currently{" "}
              <strong>{formatPrice(course.data?.price_cents ?? 0, course.data?.currency ?? "USD")}</strong>.
            </p>
          </div>
        </section>

        <section className="chunky mt-8 rounded-2xl border-2 bg-card p-4 sm:p-6">
          <h2 className="font-display text-2xl font-bold">Lessons</h2>

          <div className="mt-4 space-y-3">
            {lessons.data?.map((lesson, index) => (
              <div key={lesson.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border-2 p-3 sm:p-4">
                <div>
                  <p className="break-words font-bold">
                    {index + 1}. {lesson.title}
                  </p>
                  <p className="text-xs uppercase text-muted-foreground">{lesson.kind}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${lesson.title}`}
                  onClick={() => removeLesson(lesson.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 rounded-xl border-2 border-dashed p-4">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Lesson title"
              className="chunky h-12 rounded-xl border-2 font-bold"
            />
            <div className="flex gap-2">
              {(["video", "text"] as LessonKind[]).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={newKind === kind ? "default" : "outline"}
                  onClick={() => setNewKind(kind)}
                  className="chunky rounded-xl border-2 font-bold capitalize"
                >
                  {kind}
                </Button>
              ))}
            </div>
            {newKind === "video" ? (
              <Input
                value={newVideo}
                onChange={(event) => setNewVideo(event.target.value)}
                placeholder="YouTube or Vimeo link"
                className="chunky h-12 rounded-xl border-2"
              />
            ) : (
              <Textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                placeholder="Lesson content"
                className="chunky min-h-32 rounded-xl border-2"
              />
            )}
            <Button onClick={addLesson} className="chunky h-12 rounded-xl font-bold">
              <Plus className="size-4" /> Add lesson
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
