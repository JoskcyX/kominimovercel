import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * "I agree to the Terms of Use and Privacy Policy" — required before sign-up and before a student
 * joins a class or quiz. The links open in a new tab so nobody loses what they were typing.
 */
export function ConsentCheckbox({
  id,
  checked,
  onChange,
  audience = "tutor",
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  audience?: "tutor" | "student";
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-card p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
        aria-required="true"
      />
      <label htmlFor={id} className="text-sm leading-snug text-muted-foreground">
        I have read and agree to the{" "}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          Terms of Use
        </Link>{" "}
        and the{" "}
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>
        {audience === "student"
          ? ", including how my name and phone/matric number are used for this class."
          : "."}
      </label>
    </div>
  );
}
