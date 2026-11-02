<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Schema-qualify extension functions in database trigger functions with fixed search paths; this prevents account creation failures.
- Normalize authentication errors from structured objects and replace empty messages with actionable text; service errors may not be native Error instances.
- Quiz projection and student screens share skip_signal (reset to zero on start) and database-maintained deadlines; automatic advancement uses an atomic deadline-checked RPC so clients cannot advance early or twice. Keep projection separate from editing and never project contact details.
- Destructive confirmations use the shared ConfirmAction dialog; keep it open on failure and disable repeated submissions while pending.
- Mobile layouts use shrinking text columns and fixed action columns, stacking toolbars and date fields below sm; shared CSS supplies touch targets and non-zooming form text without hiding overflow.
