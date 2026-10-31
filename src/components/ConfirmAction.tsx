import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function ConfirmAction({ open, onOpenChange, title, description, label = "Delete", pending, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  label?: string; pending: boolean; onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={(value) => { if (!pending) onOpenChange(value); }}>
    <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg border-2 bg-card sm:max-w-md">
      <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><Trash2 className="size-6" /></div>
      <AlertDialogHeader>
        <AlertDialogTitle className="break-words font-display text-2xl">{title}</AlertDialogTitle>
        <AlertDialogDescription className="break-words">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending ? "Please wait…" : label}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}