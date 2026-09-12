# PMOfix API contracts

Three public JSON endpoints drive the whole funnel. They are deliberately public
(no auth) because submissions are anonymous; abuse protection is on the first call.

Base path today: `/api/public/match/*` (TanStack server routes). On FastAPI, mount
them as `POST /api/public/match/draft`, `.../prematch`, `.../finalize`.

---

## POST /api/public/match/draft

Creates or updates the submission row. Called once per funnel step.

Request (all fields optional except as noted):
```json
{
  "id": "uuid",                  // omit on first call; required after
  "description": "string 5..5000",   // required on the first call
  "category": "string|null",
  "platforms": ["string"],
  "platforms_other": "string|null",
  "frequency": "string|null",
  "cost_impact": "string|null",
  "dream_fix": "string|null",
  "first_name": "string|null",
  "email": "email",
  "work_type": "string|null",
  "user_id": "uuid|null",
  "turnstile_token": "string",   // required on the FIRST call only
  "company_website": ""          // honeypot: must stay empty
}
```
Response: `{ "id": "uuid" }`

Rules:
- `Content-Type` must be JSON, else `415`.
- Non-empty honeypot → return a fake `{ "id": "000...0" }` and write nothing.
- First call with no/invalid Turnstile token → `400`.
- Later calls are gated by owning a valid `id`.

## POST /api/public/match/prematch

Fire-and-forget. Runs the AI match on whatever the row contains so far and stores
the result with `stage: "prematch"`. Sends no email. Client does not await it.

Request: `{ "id": "uuid" }`
Response: the result object (ignored by the client).

## POST /api/public/match/finalize

Request: `{ "id": "uuid" }`
Response: the full result object (see BUILD-SUMMARY §4).

Logic:
- If `match_result.stage == "prematch"` and the row has no `dream_fix`, reuse the
  cached result, restamp it as `final`, queue the email, return it.
- Otherwise re-run the AI with the complete context, save, email, return.

Client uses a 25s timeout and shows a graceful fallback result rather than spinning.

---

## Important migration note

The original build used typed RPC server functions with an auth middleware
attached globally. That middleware called `getSession()` on every request and hung
in Chrome for anonymous visitors, producing an infinite spinner. Moving the public
submission path to plain HTTP endpoints with `fetch` fixed it.

Lesson for the port: keep the anonymous submission path completely free of any
auth-dependent middleware.
