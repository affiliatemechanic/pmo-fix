# Staged background matching

Use the `pmo_submissions` row itself as the "running scratchpad." Each step writes its slice; the AI match runs in the background after Step 2 while the user is still answering Steps 3 & 4. Step 4 either grabs the cached result or runs/waits for it, then sends the email and shows results.

## What changes for the user

- Steps 1–3 still feel instant (just a `setStep(n+1)` after a tiny save).
- Step 4 "Show me my fix" usually returns in well under a second — the heavy AI work already finished while they were typing their dream fix.
- If they're a speed-typer and the AI hasn't finished, Step 4 just waits for the same job (no duplicate matching).
- If anything fails along the way, the row still exists with whatever they entered — visible in Admin → Submissions, and the final fallback still kicks in.

## New endpoints (all under `/api/public/match/*`)

1. **`POST /api/public/match/draft`** — upsert partial fields onto a submission row.
   - Step 1 sends `{ description, category }`, server inserts a new row, returns `{ id }`.
   - Steps 2 & 3 send `{ id, ...partial }`, server updates that row, returns `{ ok: true }`.
   - No AI work here. Cheap. Reused for every interim save.

2. **`POST /api/public/match/prematch`** — fire-and-forget background matcher.
   - Called by the client right after Step 2 finishes (so platforms are known).
   - Reads the row, runs the existing AI match logic, writes the result to `match_result` (jsonb) with a `stage: "prematch"` marker so we know it's preliminary.
   - Client does NOT await the response — it's literally `fetch(...).catch(noop)` and the user keeps going.

3. **`POST /api/public/match/finalize`** — the real submit.
   - Called from Step 4 with `{ id, dream_fix, first_name, email, work_type }`.
   - Updates the row with the final fields.
   - If a fresh prematch already exists in `match_result`, uses it (and optionally lightly re-ranks/re-headlines now that `dream_fix` is known). If not, runs the full match inline (current behavior).
   - Sends the result email, returns the `MatchResult` to the client.

The existing `/api/public/match` POST stays as a back-compat path (and gets used if any non-staged caller hits it).

## Client changes (`src/routes/index.tsx`)

- Add `const [submissionId, setSubmissionId] = useState<string | null>(null)`.
- Step 1 "Next" handler → `await draftSubmission({ description, category })` → store id → `setStep(2)`. Tiny spinner on the button only.
- Step 2 "Next" handler → `draftSubmission({ id, platforms, platforms_other })` → `setStep(3)` → `void prematch(id)` (no await).
- Step 3 "Next" handler → `draftSubmission({ id, frequency, cost_impact })` → `setStep(4)`.
- Step 4 "Show me my fix" → `await finalize({ id, ...finalFields })` → existing results screen.
- Email validation stays on Step 4. If any interim save fails (network), we log it and just continue — the finalize call will upsert everything anyway.

## Server changes

- Extract the current AI match body (lines ~491–657 of `src/lib/match.functions.ts`) into a reusable `runMatchForSubmissionId(id)` helper that reads the row, runs the match, writes `match_result`, returns it. Both `prematch` and `finalize` call this.
- `finalize` checks `match_result?.stage === "prematch"` and a `matched_at` freshness window (e.g. <5 min old). If present, skip re-running the AI — just stamp `stage: "final"`, send the email, return.
- All three new endpoints live in `src/routes/api/public/match/` as separate files (`draft.ts`, `prematch.ts`, `finalize.ts`).

## Schema

No schema change required — `match_result jsonb` already holds anything, and we just add a `stage` field inside the JSON. The existing admin Submissions tab will show interim drafts and the prematch result as the user progresses (great for debugging).

## Failure modes covered

- User abandons mid-funnel → row persists with whatever they entered; visible in admin.
- Prematch AI call fails → silently logged; finalize runs the match inline like today.
- User goes "Back" and changes platforms after prematch ran → finalize sees stale data is older than the new edits (we'll just always re-run if final fields differ meaningfully, or simplest: always re-run if Step 2/3 were touched after the prematch wrote). For v1, simplest rule: **finalize re-runs the match if `dream_fix` was provided** (since dream_fix wasn't in prematch input anyway), otherwise reuses prematch. That keeps it honest without complicated diffing.
- Two prematch calls race (user clicks Next twice) → both write to the same row; last write wins, no corruption.

## Out of scope for this pass

- Showing partial/streaming results during Steps 3–4 (could be a nice v2 — a tiny "💡 we think we found something..." hint).
- Cleaning up abandoned draft rows (can add a nightly cleanup later if it gets noisy).

Ready to build this when you approve.
