import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/ConfirmAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEGAL_VERSIONS } from "@/config/legal";
import { tierFor } from "@/config/plans";
import { SITE } from "@/config/site";
import { ME_KEY, useMe } from "@/hooks/usePlan";
import { deleteAuthIdentity, signOutUser } from "@/lib/auth-client";
import { deleteMyAccount, exportMyData, updateDisplayName } from "@/lib/me.functions";

export const Route = createFileRoute("/_authenticated/account")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: `Account — ${SITE.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function AccountPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "save" | "export" | "delete">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (me.data) setName(me.data.displayName);
  }, [me.data]);

  const save = async () => {
    setBusy("save");
    try {
      await updateDisplayName({ data: { name } });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      toast.success("Name updated");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("export");
    try {
      const { json } = await exportMyData();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${SITE.name.toLowerCase()}-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data was downloaded");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const erase = async () => {
    setBusy("delete");
    try {
      await deleteMyAccount({ data: { confirm: "DELETE" } });
      // Also remove the sign-in record itself. If the auth service doesn't allow that, say so honestly.
      const identityRemoved = await deleteAuthIdentity();
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOutUser();
      if (identityRemoved) toast.success("Your account and data were permanently deleted");
      else
        toast.success(
          "Your data was permanently deleted. Your sign-in record couldn't be removed automatically — contact us and we'll remove it.",
          { duration: 12000 },
        );
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(null);
    }
  };

  const tier = tierFor(me.data?.plan);

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
        <Button asChild variant="ghost" className="font-bold">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Account</h1>

        <section className="surface-card mt-6 space-y-4 p-5 sm:p-6" aria-labelledby="profile-h">
          <h2 id="profile-h" className="text-xl font-bold">
            Profile
          </h2>
          <div className="space-y-2">
            <Label htmlFor="acc-name">Display name</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="acc-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl border-2"
              />
              <Button
                onClick={save}
                disabled={busy === "save" || !name.trim() || name.trim() === me.data?.displayName}
                className="chunky h-11 rounded-xl font-bold"
              >
                Save
              </Button>
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-bold">{me.data?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-bold">
                {tier.name}{" "}
                {tier.id === "free" && (
                  <Link
                    to="/upgrade"
                    className="ml-2 text-primary underline-offset-4 hover:underline"
                  >
                    See Pro
                  </Link>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface-card mt-6 space-y-2 p-5 sm:p-6" aria-labelledby="legal-h">
          <h2 id="legal-h" className="text-xl font-bold">
            Terms &amp; privacy
          </h2>
          <p className="text-sm text-muted-foreground">You've accepted the current versions:</p>
          <p className="flex flex-wrap gap-4 text-sm font-bold">
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Use ({LEGAL_VERSIONS.terms})
            </Link>
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy ({LEGAL_VERSIONS.privacy})
            </Link>
          </p>
        </section>

        <section className="surface-card mt-6 space-y-3 p-5 sm:p-6" aria-labelledby="data-h">
          <h2 id="data-h" className="text-xl font-bold">
            Your data
          </h2>
          <p className="text-sm text-muted-foreground">
            Download a copy of everything stored under your account — profile, quizzes, classes,
            students, attendance and courses — as a JSON file.
          </p>
          <Button
            variant="outline"
            onClick={download}
            disabled={busy === "export"}
            className="chunky rounded-xl border-2 font-bold"
          >
            <Download className="size-4" /> {busy === "export" ? "Preparing…" : "Download my data"}
          </Button>
        </section>

        <section
          className="mt-6 space-y-3 rounded-2xl border-2 border-destructive/40 bg-card p-5 sm:p-6"
          aria-labelledby="danger-h"
        >
          <h2 id="danger-h" className="text-xl font-bold text-destructive">
            Delete account
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently deletes your profile and everything you own — classes, students, attendance,
            quizzes, courses and uploaded files. This cannot be undone. Consider downloading your
            data first.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setTyped("");
              setConfirmOpen(true);
            }}
            className="rounded-xl border-2 border-destructive font-bold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" /> Delete my account
          </Button>
        </section>

        <ConfirmAction
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete your account permanently?"
          description="Everything you own will be erased. Type DELETE below to confirm."
          pending={busy === "delete"}
          onConfirm={() => {
            if (typed === "DELETE") void erase();
            else toast.error("Type DELETE (in capitals) to confirm");
          }}
        >
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm"
            className="mt-3 h-11 rounded-xl border-2"
          />
        </ConfirmAction>
      </main>
    </div>
  );
}
