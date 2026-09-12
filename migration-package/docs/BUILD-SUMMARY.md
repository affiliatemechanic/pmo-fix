# PMOfix — Build Summary (migration reference)

Source app: React 19 + TanStack Start (SSR) on Lovable, Postgres (Supabase) backend.
Target in the contest plan: React frontend + FastAPI backend + MongoDB.

This document describes the live behavior exactly as it works today so it can be
rebuilt on another stack without guessing.

---

## 1. Product in one paragraph

A visitor describes something that pisses them off about their workflow ("a PMO"),
answers four short questions, and gets an AI-matched fix. The matcher runs a
strict hierarchy: internal catalog match → internal adjacent → known external
tool → declared gap (build candidate). The result is saved to the submission row
and emailed to the user.

## 2. Funnel (5 stages, one page)

| Step | User does | Backend call | What happens |
|---|---|---|---|
| 1 | Rant + category. Turnstile + honeypot | `POST /api/public/match/draft` | Bot check, then create submission row, return `id` |
| 2 | Pick platforms (+ "other" free text) | `POST /api/public/match/draft` then fire-and-forget `POST /api/public/match/prematch` | Draft updated; AI match runs in background while user keeps answering |
| 3 | Frequency + cost/impact | `POST /api/public/match/draft` | Draft updated |
| 4 | Dream fix (free text) | `POST /api/public/match/draft` | Draft updated (invalidates prematch reuse) |
| 5 | First name + email → submit | `POST /api/public/match/finalize` | Reuse cached prematch if still valid, else re-run AI; save result; queue email; return result |

Key design point: the AI work is started at step 2 so the perceived wait at step 5
is typically under 2 seconds.

## 3. Data model (Postgres today)

### `pmo_submissions` — one row per visitor, used as a live scratchpad
```
id              uuid pk
description     text not null      -- the rant
email           text
first_name      text
category        text
platforms       text[]
platforms_other text
frequency       text
cost_impact     text
dream_fix       text
work_type       text
user_id         uuid null          -- optional logged-in user
match_result    jsonb              -- full result object, incl. stage: prematch|final
matched_at      timestamptz
created_at      timestamptz default now()
```

### `fixes` — the catalog (products + recommendable tools)
```
id          uuid pk
name        text not null
type        text not null default 'internal_product'   -- live data uses 'in_house'
summary     text not null       -- long-form marketing copy, may contain <BR> tags
description text
url         text
categories  text[]
platforms   text[]
tags        text[]              -- heavy keyword list, drives text matching
price_note  text
image_url   text                -- public storage URL
active      bool default true   -- inactive fixes are excluded from matching
```

### Supporting tables (email + auth), keep or replace as the target stack allows
```
email_send_log            message_id, template_name, recipient_email, status, error_message, metadata
email_unsubscribe_tokens  token, email, used_at
suppressed_emails         email
user_roles                user_id, role ('admin')   -- roles live in their own table, never on profiles
aweber_settings / aweber_list_map   -- AWeber OAuth tokens + product→list mapping
```

### MongoDB mapping (if using Mongo)
- `pmo_submissions` → collection `submissions`, arrays stay arrays, `match_result` stays an embedded doc.
- `fixes` → collection `fixes`, same fields; index on `active` and a text index on `name, summary, description, tags`.
- `user_roles` → collection `user_roles`, unique compound index on `(user_id, role)`.
- Email log/tokens/suppressions → three small collections with unique indexes on `message_id`, `token`, `email`.

## 4. Matching engine

Model: `google/gemini-2.5-flash` via the Lovable AI Gateway (any equivalent
Gemini/OpenAI-class model works — the logic is in the prompt, not the vendor).

Order of operations in `runMatchInner`:
1. Load all `fixes` where `active = true` into a compact catalog array.
2. Call the model with structured JSON output (see `docs/AI-PROMPTS.md`).
3. If structured output fails → retry as plain text and parse the first `{...}` block.
4. If that fails too → deterministic backup matcher (below).
5. If the model says `gap` but the deterministic matcher finds something, prefer the deterministic hit.
6. Validate `matched_fix_id` against the catalog (drop it if hallucinated).
7. Normalize the runner-up (must have a reason, must not equal the winner).
8. Write result to `pmo_submissions.match_result`, stamp `matched_at`.
9. Queue the result email (final stage only).

Timeouts: 45s AI abort signal, 10s on each DB read/write.

### Deterministic backup matcher (no AI required)
1. Concatenate description + category + platforms + other + dream fix, lowercase.
2. Regex rule table for well-known external tools (see `seed/external-fallback-rules.ts`).
3. Otherwise tokenize (words of 4+ chars) and score each catalog fix by token hits
   across name/summary/description/categories/platforms/tags; long tokens score 2, short 1.
4. Score ≥ 4 → `recommended` with that fix. Else → `gap` build-candidate copy.

### Result object contract
```json
{
  "verdict": "match | recommended | gap",
  "confidence": "low | medium | high",
  "matched_fix_id": "uuid | null",
  "matched_fix": { "id","name","type","summary","url","price_note","image_url" },
  "external_recommendation": { "name", "url", "why" },
  "headline": "string",
  "reasoning": "string",
  "next_steps": ["string"],
  "runner_up": {
    "why_winner_edged_it": "string",
    "matched_fix": { ... } ,
    "external_name": "string|null",
    "external_url": "string|null"
  },
  "submission_id": "uuid",
  "stage": "prematch | final"
}
```

## 5. Non-negotiable rule baked into the prompt

Always recommend the genuinely best fit, even when that is a paid external
competitor. Never weight results toward in-house products. Trust is the product.
The runner-up block exists to show the honest close call, and must be `null` when
there wasn't one.

## 6. Result page presentation

- Match score badge above the headline: 92% for `match`, 78% for `recommended`, none for `gap`.
- "Why this was recommended" bullets, derived by splitting the reasoning text.
- Product card (image, name, summary, price note, CTA) or external recommendation card.
- "We almost recommended…" runner-up block.
- Gold gradient divider, then Next steps.

## 7. Email

Transactional send with an outbound queue + log:
- Idempotency key `match-result-{submission_id}`; duplicate sends are skipped.
- Suppression list and unsubscribe token checked before send.
- Log row written as `pending`, then the queue worker flips it to `sent`/`failed`.
- From: `Jeffrey Levesque <noreply@notify.pmofix.com>` (subdomain sender with SPF/DKIM/DMARC).
- HTML and plain text are rendered inline (no template engine) so nothing can fail silently.

On FastAPI: replace the queue with a background task or Celery/RQ job and any
sender (Resend, SES, Postmark). Keep the log + idempotency key — that pair is
what makes delivery debuggable.

## 8. Abuse protection (all on the first draft call)

- Cloudflare Turnstile server-side verification (`/turnstile/v0/siteverify`), only on the first draft.
- Hidden `company_website` honeypot → fake success, nothing written.
- Zod validation on every field, with hard max lengths.
- Later steps are gated by the existing submission `id`.

## 9. Admin

`/admin`, gated by an `admin` row in `user_roles`:
- Fixes editor incl. image upload to a public storage bucket (5MB cap).
- Submissions report: every request field, the saved `match_result` (rendered + raw JSON),
  latest email status, search/filter, inline edit, delete.

## 10. Environment / secrets

```
AI provider key            (Lovable AI Gateway key today)
TURNSTILE_SECRET_KEY       + public site key in the frontend
Database URL
Email sender API key + sending domain
AWeber OAuth client (optional)
```

## 11. Biggest risk to protect

The four-tier hierarchy behaving correctly (internal → adjacent → external → gap)
plus category handling. The screens are easy; the honest hierarchy is the product.
Port the prompt verbatim first, then tune.
