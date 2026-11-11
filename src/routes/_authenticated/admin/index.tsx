import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, MailOpen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE } from "@/config/site";
import {
  adminListContact,
  adminListUsers,
  adminMarkContact,
  adminSetUserPlan,
  adminSetUserStatus,
  adminStats,
} from "@/lib/admin.functions";
import { getMe } from "@/lib/me.functions";

/**
 * ADMIN DASHBOARD — starter. See docs/ADMIN.md for how to extend it.
 * The route guard below is only for a tidy experience; every admin API call is re-checked on the
 * server (role middleware) and again inside the database function.
 */
export const Route = createFileRoute("/_authenticated/admin/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: `Admin — ${SITE.name}` }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const me = await getMe().catch(() => null);
    if (!me?.isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">
        {value === undefined ? "…" : value.toLocaleString("en")}
      </p>
    </div>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => adminStats() });
  const users = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => adminListUsers({ data: { q, limit: 50, offset: 0 } }),
  });
  const inbox = useQuery({
    queryKey: ["admin", "contact"],
    queryFn: () => adminListContact({ data: { status: null } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const setStatus = useMutation({
    mutationFn: (v: { userId: string; status: "active" | "suspended" }) =>
      adminSetUserStatus({ data: v }),
    onSuccess: () => {
      refresh();
      toast.success("Updated");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const setPlan = useMutation({
    mutationFn: (v: { userId: string; plan: "free" | "pro" }) => adminSetUserPlan({ data: v }),
    onSuccess: () => {
      refresh();
      toast.success("Plan updated");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const mark = useMutation({
    mutationFn: (v: { id: string; status: "new" | "read" | "resolved" | "spam" }) =>
      adminMarkContact({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-10">
        <Button asChild variant="ghost" className="font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Admin</h1>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Overview">
          <Stat label="Users" value={stats.data?.users} />
          <Stat label="Pro users" value={stats.data?.pro_users} />
          <Stat label="Signups (7 days)" value={stats.data?.signups_7d} />
          <Stat label="Live classes now" value={stats.data?.live_now} />
          <Stat label="Classes" value={stats.data?.classes} />
          <Stat label="Quizzes" value={stats.data?.quizzes} />
          <Stat label="Courses" value={stats.data?.courses} />
          <Stat label="Unread messages" value={stats.data?.open_messages} />
        </section>

        <section className="mt-10" aria-labelledby="users-h">
          <h2 id="users-h" className="text-2xl font-bold">
            Users
          </h2>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            className="mt-3 h-11 max-w-sm rounded-xl border-2"
            aria-label="Search users"
          />
          <div className="surface-card mt-3 overflow-x-auto p-2">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="p-2">User</th>
                  <th className="p-2">Plan</th>
                  <th className="p-2">Content</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="p-2">
                      <p className="font-bold">
                        {u.display_name || "—"}{" "}
                        {u.roles.includes("admin") && (
                          <span className="ml-1 rounded bg-primary px-1.5 text-xs text-primary-foreground">
                            admin
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-2">{u.plan}</td>
                    <td className="p-2 text-muted-foreground">
                      {u.classes} classes · {u.quizzes} quizzes
                    </td>
                    <td className="p-2">{u.status}</td>
                    <td className="space-x-2 p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPlan.mutate({ userId: u.id, plan: u.plan === "pro" ? "free" : "pro" })
                        }
                      >
                        {u.plan === "pro" ? "Set Free" : "Set Pro"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatus.mutate({
                            userId: u.id,
                            status: u.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {u.status === "active" ? "Suspend" : "Reinstate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="inbox-h">
          <h2 id="inbox-h" className="text-2xl font-bold">
            Contact messages
          </h2>
          <div className="mt-3 space-y-3">
            {inbox.data?.length === 0 && <p className="text-muted-foreground">No messages.</p>}
            {inbox.data?.map((m) => (
              <article key={m.id} className="surface-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {m.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {m.email} · {m.topic}
                    </span>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()} · {m.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.message}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mark.mutate({ id: m.id, status: "read" })}
                  >
                    <MailOpen className="size-4" /> Read
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mark.mutate({ id: m.id, status: "resolved" })}
                  >
                    <Check className="size-4" /> Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mark.mutate({ id: m.id, status: "spam" })}
                  >
                    Spam
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
