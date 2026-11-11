import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ShieldCheck, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ConfirmAction";
import { repGetMembers, repRemove, repSetStatus } from "@/lib/member.functions";
import { isRecentlyPresent } from "@/lib/live-connection";

export type RepMember = { id: string; name: string; phone: string; status: "pending" | "approved" | "rejected"; last_seen_at: string | null; left_at: string | null };

/** Polls the rep's class; returns null when this student is not the class rep. */
/** `token` is the student's signed session token (not their id). */
export function useRepMembers(token: string | null) {
  const [members, setMembers] = useState<RepMember[] | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      setMembers(await repGetMembers({ data: { token } })); // null when this student isn't the rep
    } catch {
      /* keep last known list through a blip */
    }
  }, [token]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);
  // Ping the rep for every newly waiting student.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!members) return;
    const pend = members.filter((m) => m.status === "pending");
    if (seen.current) for (const m of pend) if (!seen.current.has(m.id)) toast(`${m.name} wants to join the class`, { description: "You're the class rep — let them in below." });
    seen.current = new Set(pend.map((m) => m.id));
  }, [members]);
  return { members, reload: load };
}

export function RepJoinNotices({ token, members, reload }: { token: string; members: RepMember[]; reload: () => void }) {
  const pending = members.filter((m) => m.status === "pending");
  const decide = async (id: string, status: "approved" | "rejected") => {
    try {
      await repSetStatus({ data: { token, memberId: id, status } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update request");
    }
    reload();
  };
  if (!pending.length) return null;
  return (
    <>
      {pending.map((m) => (
        <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border-2 border-primary bg-card p-2 shadow-lg">
          <div className="min-w-0"><p className="truncate text-sm font-bold">{m.name} wants to join</p><p className="truncate text-xs text-muted-foreground">{m.phone}</p></div>
          <div className="flex gap-1">
            <Button size="icon" className="size-11" onClick={() => decide(m.id, "approved")} aria-label={`Let ${m.name} in`}><Check className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-11" onClick={() => decide(m.id, "rejected")} aria-label={`Decline ${m.name}`}><X className="size-4" /></Button>
          </div>
        </div>
      ))}
    </>
  );
}

export function RepPanel({ token, selfId, members, reload }: { token: string; selfId: string; members: RepMember[]; reload: () => void }) {
  const [removing, setRemoving] = useState<RepMember | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = members.filter((m) => m.status === "approved" && m.id !== selfId);
  const pending = members.filter((m) => m.status === "pending");
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await repRemove({ data: { token, memberId: removing.id } });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not remove student");
      return;
    }
    setBusy(false);
    toast.success(`${removing.name} removed`);
    setRemoving(null);
    reload();
  };
  return (
    <section className="surface-card grid gap-4 border-secondary p-4">
      <ConfirmAction open={!!removing} onOpenChange={(v) => { if (!v) setRemoving(null); }} title="Remove student?" description={`${removing?.name ?? "This student"} will be removed from the class. Your tutor can see this.`} label="Remove student" pending={busy} onConfirm={remove} />
      <div className="flex items-center gap-2"><ShieldCheck className="size-6 shrink-0 text-secondary" /><div><p className="text-lg font-bold">You're the class rep</p><p className="text-xs text-muted-foreground">Your tutor sees everything you do here. In the video, you can also mute students.</p></div></div>
      <div className="grid gap-2">
        <p className="font-bold">Join requests ({pending.length})</p>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">No one is waiting.</p> : <RepJoinNotices token={token} members={members} reload={reload} />}
      </div>
      <div className="grid gap-2">
        <p className="font-bold">Students ({approved.length})</p>
        {approved.map((m) => (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2">
            <div className="min-w-0"><p className="truncate text-sm font-bold">{m.name}</p><p className="truncate text-xs text-muted-foreground">{isRecentlyPresent(m.last_seen_at, m.left_at) ? "In live class" : m.phone}</p></div>
            <Button size="icon" variant="outline" className="size-11" aria-label={`Remove ${m.name}`} onClick={() => setRemoving(m)}><UserMinus className="size-4" /></Button>
          </div>
        ))}
      </div>
    </section>
  );
}
