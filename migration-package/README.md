# PMOfix migration package

Everything needed to rebuild PMOfix on another stack (e.g. React + FastAPI + MongoDB)
without reverse-engineering the live site.

```
docs/BUILD-SUMMARY.md     Full app spec: funnel, schema, matching engine, email, admin, secrets
docs/AI-PROMPTS.md        The system + user prompts, verbatim
docs/API-CONTRACTS.md     The three public endpoints, request/response shapes, gotchas
seed/fixes.json           Raw export of the active fix catalog (8 rows)
seed/fixes.seed.sql       Same catalog as SQL INSERTs
seed/fixes.mongo.json     Same catalog, ready for mongoimport
seed/external-fallback-rules.ts  Regex rule table for known external tool recommendations
assets/pmofix-logo.png    Logo
assets/pmofix-promise.png "PMOfix Promise" trust graphic
assets/styles.css         Full design tokens: navy/gold palette, Sora/Inter fonts, radii, shadows
```

Not included: submission data (test rows only), email/auth tables' contents,
AWeber tokens, Turnstile secret, and the two inactive catalog entries
(Article Padlock, AEO Interceptor) since they are excluded from matching anyway.

Build order that de-risks the port:
1. Schema + seed the catalog.
2. The three endpoints, with the prompt copied verbatim.
3. Result page presentation.
4. Email + log with the idempotency key.
5. Turnstile + honeypot.
6. Admin.
