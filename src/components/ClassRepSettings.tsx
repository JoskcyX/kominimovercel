import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { listRepActions, setClassRep } from "@/lib/classes.functions";

export function ClassRepSettings({ classId, repId, students }: { classId: string; repId: string | null; students: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const log = useQuery({
    queryKey: ["class", classId, "rep-log"],
    refetchInterval: 8000,
    queryFn: () => listRepActions({ data: { classId } }),
  });
  const setRep = useMutation({
    mutationFn: async (id: string | null) => { await setClassRep({ data: { classId, memberId: id } }); },
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ["class", classId] }); toast.success(id ? "Class rep set — join requests now go to them" : "Class rep removed — join requests come to you"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update class rep"),
  });
  return (
    <section className="surface-card mt-8 grid gap-3 p-4">
      <div className="flex items-center gap-2"><ShieldCheck className="size-5 shrink-0 text-secondary" /><h2 className="text-xl font-bold">Class rep</h2></div>
      <p className="text-sm text-muted-foreground">A rep can let students in, remove them and mute them in the video. Join pop-ups go to the rep instead of you.</p>
      <select value={repId ?? ""} disabled={setRep.isPending} onChange={(e) => setRep.mutate(e.target.value || null)} className="h-11 w-full min-w-0 rounded-xl border-2 border-input bg-background px-3">
        <option value="">No rep — I handle join requests</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Rep activity ({log.data?.length ?? 0})</summary>
        <div className="mt-2 grid gap-1 text-sm">
          {!log.data?.length && <p className="text-muted-foreground">Nothing yet.</p>}
          {log.data?.map((a) => (
            <p key={a.id} className="break-words"><span className="font-bold">{a.rep_name}</span> {a.action} <span className="font-bold">{a.target_name}</span> <span className="text-xs text-muted-foreground">· {new Date(a.created_at).toLocaleString()}</span></p>
          ))}
        </div>
      </details>
    </section>
  );
}
