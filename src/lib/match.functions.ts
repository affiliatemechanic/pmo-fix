import { createServerFn } from "@tanstack/react-start";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway";
import { getKnownExternalRecommendation } from "./match-rules";

const SITE_NAME = "pmo-fix";
const SENDER_DOMAIN = "notify.pmofix.com";
const FROM_DOMAIN = "notify.pmofix.com";

function generateEmailToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMatchEmailHtml(data: {
  firstName?: string;
  headline: string;
  reasoning: string;
  problemPreview: string;
  matchedFix: { name: string; summary: string; url?: string; price_note?: string } | null;
  nextSteps: string[];
}): string {
  const greeting = data.firstName ? `${escapeHtml(data.firstName)}, ` : "";
  const fixBlock = data.matchedFix
    ? `<div style="border:1px solid #e8e4dd;border-radius:12px;padding:20px 22px;margin:8px 0 24px;background:#fff;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#b8860b;margin:0 0 6px;font-weight:bold;">The fix</div>
        <h2 style="font-size:20px;font-weight:bold;color:#0d0d0d;margin:8px 0 12px;">${escapeHtml(data.matchedFix.name)}</h2>
        <p style="font-size:15px;color:#3a3a3a;line-height:1.6;margin:0 0 16px;">${escapeHtml(data.matchedFix.summary)}</p>
        ${data.matchedFix.price_note ? `<p style="font-size:13px;color:#7a7a7a;margin:0 0 16px;">${escapeHtml(data.matchedFix.price_note)}</p>` : ""}
        ${data.matchedFix.url ? `<a href="${escapeHtml(data.matchedFix.url)}" style="background:#0d0d0d;color:#fff;font-size:14px;font-weight:bold;border-radius:8px;padding:12px 22px;text-decoration:none;display:inline-block;">Get this fix</a>` : ""}
      </div>`
    : `<div style="border:1px dashed #d6d2c8;border-radius:12px;padding:20px 22px;margin:8px 0 24px;background:#fafaf7;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#b8860b;margin:0 0 6px;font-weight:bold;">What this means</div>
        <p style="font-size:15px;color:#3a3a3a;line-height:1.6;margin:0;">Nothing in our current fix library nails this one. We've flagged it as a build candidate — the more people who vent about the same thing, the faster we build it.</p>
      </div>`;
  const steps = data.nextSteps.length
    ? `<h3 style="font-size:14px;font-weight:bold;color:#0d0d0d;margin:28px 0 12px;text-transform:uppercase;letter-spacing:.08em;">Next steps</h3><ul style="padding-left:20px;margin:0 0 16px;">${data.nextSteps
        .map((step) => `<li style="font-size:15px;color:#3a3a3a;line-height:1.6;margin:0 0 8px;">${escapeHtml(step)}</li>`)
        .join("")}</ul>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(data.headline)}</title></head><body style="background:#fff;font-family:Arial,sans-serif;margin:0;"><div style="padding:24px 28px;max-width:600px;"><div style="font-size:24px;font-weight:bold;color:#b8860b;margin:0 0 24px;">PMO<span style="color:#0d0d0d;">fix</span></div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#b8860b;margin:0 0 8px;font-weight:bold;">Your PMO verdict</div><h1 style="font-size:26px;font-weight:bold;color:#0d0d0d;margin:0 0 24px;line-height:1.25;">${greeting}${escapeHtml(data.headline)}</h1><div style="border-left:3px solid #b8860b;padding:12px 16px;margin:0 0 24px;background:#faf7f0;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8a7a4a;margin:0 0 6px;">You said:</div><p style="font-size:14px;color:#3a3a3a;line-height:1.5;margin:0;font-style:italic;">&quot;${escapeHtml(data.problemPreview)}&quot;</p></div><p style="font-size:15px;color:#3a3a3a;line-height:1.6;margin:0 0 16px;">${escapeHtml(data.reasoning)}</p>${fixBlock}${steps}<hr style="border:none;border-top:1px solid #e8e4dd;margin:32px 0 16px;"><p style="font-size:12px;color:#999;margin:0;">Sent by PMOfix · <a href="https://pmofix.com" style="color:#b8860b;text-decoration:none;">pmofix.com</a></p></div></body></html>`;
}

function renderMatchEmailText(data: {
  headline: string;
  reasoning: string;
  problemPreview: string;
  matchedFix: { name: string; summary: string; url?: string; price_note?: string } | null;
  nextSteps: string[];
}): string {
  return [
    data.headline,
    "",
    `You said: ${data.problemPreview}`,
    "",
    data.reasoning,
    "",
    data.matchedFix ? `The fix: ${data.matchedFix.name}\n${data.matchedFix.summary}${data.matchedFix.url ? `\n${data.matchedFix.url}` : ""}` : "No exact fix exists yet. We flagged this as a build candidate.",
    data.nextSteps.length ? `\nNext steps:\n${data.nextSteps.map((s) => `- ${s}`).join("\n")}` : "",
  ].join("\n");
}

export const SubmissionInputSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(5).max(5000),
  email: z.string().email().max(255),
  category: z.string().max(100).nullable().optional(),
  platforms: z.array(z.string().max(200)).max(30).nullable().optional(),
  platforms_other: z.string().max(500).nullable().optional(),
  frequency: z.string().max(50).nullable().optional(),
  cost_impact: z.string().max(50).nullable().optional(),
  dream_fix: z.string().max(5000).nullable().optional(),
  first_name: z.string().max(100).nullable().optional(),
  work_type: z.string().max(100).nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
});

// NOTE: keep schema very permissive — model JSON can omit optional fields,
// return nulls, or vary scalar/array shapes. We normalize after parsing.
const MatchSchema = z.object({
  verdict: z.enum(["match", "recommended", "gap"]).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  matched_fix_id: z.string().nullish(),
  external_recommendation: z
    .object({
      name: z.string().optional(),
      url: z.string().nullish(),
      why: z.string().optional(),
    })
    .nullish(),
  headline: z.string().nullish(),
  reasoning: z.string().nullish(),
  next_steps: z.union([z.array(z.string()), z.string()]).nullish(),
});

type RawMatchOutput = z.infer<typeof MatchSchema>;

export type MatchResult = Omit<RawMatchOutput, "verdict" | "confidence" | "headline" | "reasoning" | "next_steps"> & {
  verdict: "match" | "recommended" | "gap";
  confidence: "low" | "medium" | "high";
  headline: string;
  reasoning: string;
  next_steps: string[];
  matched_fix?: {
    id: string;
    name: string;
    type: string;
    summary: string;
    url?: string;
    price_note?: string;
    image_url?: string;
  } | null;
  submission_id: string;
  /** "prematch" = background pass run before user finished funnel; "final" = post-submit. */
  stage?: "prematch" | "final";
};

/** Partial schema used by draft endpoint — every field optional except validation rules. */
export const DraftInputSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(5).max(5000).optional(),
  email: z.string().email().max(255).optional(),
  category: z.string().max(100).nullable().optional(),
  platforms: z.array(z.string().max(200)).max(30).nullable().optional(),
  platforms_other: z.string().max(500).nullable().optional(),
  frequency: z.string().max(50).nullable().optional(),
  cost_impact: z.string().max(50).nullable().optional(),
  dream_fix: z.string().max(5000).nullable().optional(),
  first_name: z.string().max(100).nullable().optional(),
  work_type: z.string().max(100).nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
});

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function fallbackMatch(submissionId: string): MatchResult {
  return {
    verdict: "gap",
    confidence: "low",
    matched_fix_id: null,
    matched_fix: null,
    headline: "You just discovered a brand new fix.",
    reasoning:
      "Nothing in our vault solves this yet — which means you're sitting on something worth building. We review every gap submission for our next product sprint. The problems that piss people off the most tend to become our biggest hits.",
    next_steps: [
      "Your PMO is locked in as a build candidate — no action needed.",
      "If we greenlight this, you'll be first to know (and first to get it free).",
      "Have a friend with the same pain? Send them here — more demand = faster build.",
    ],
    submission_id: submissionId,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || "Unknown error";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error (unserializable)";
  }
}

function extractJsonObject(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonStr = firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;
  return JSON.parse(jsonStr);
}

function normalizeSteps(steps: RawMatchOutput["next_steps"]): string[] {
  if (Array.isArray(steps)) return steps.filter(Boolean).map(String);
  if (typeof steps === "string" && steps.trim()) return [steps.trim()];
  return [];
}

type CatalogFix = {
  id: string;
  name: string;
  type: string;
  summary: string;
  description: string;
  categories: string[];
  platforms: string[];
  tags: string[];
  url: string;
  price_note: string;
  image_url: string;
};

type EmailSubmission = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  description: string;
};

function deterministicBackupMatch(
  submission: { id: string; description: string; category?: string | null; platforms?: string[] | null; platforms_other?: string | null; dream_fix?: string | null },
  catalog: CatalogFix[],
): MatchResult {
  const text = [submission.description, submission.category, submission.platforms?.join(" "), submission.platforms_other, submission.dream_fix]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const externalRules = getKnownExternalRecommendation(text);

  if (externalRules) {
    return {
      verdict: "recommended",
      confidence: "medium",
      matched_fix_id: null,
      matched_fix: null,
      external_recommendation: {
        name: externalRules.name,
        url: externalRules.url,
        why: externalRules.why,
      },
      headline: `${externalRules.name} is the fix I’d try first.`,
      reasoning: `This PMO sounds like a workflow/tooling problem more than a brand-new product gap. ${externalRules.why}`,
      next_steps: [
        `Try ${externalRules.name} against the exact workflow that keeps breaking.`,
        "If it still misses, reply to the result email and we'll treat it as a build candidate.",
      ],
      submission_id: submission.id,
    };
  }

  const tokens = new Set(text.match(/[a-z0-9]{4,}/g) ?? []);
  const best = catalog
    .map((fix) => {
      const haystack = [fix.name, fix.summary, fix.description, fix.categories.join(" "), fix.platforms.join(" "), fix.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      let score = 0;
      tokens.forEach((token) => {
        if (haystack.includes(token)) score += token.length > 6 ? 2 : 1;
      });
      return { fix, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score >= 4) {
    return {
      verdict: "recommended",
      confidence: "medium",
      matched_fix_id: best.fix.id,
      matched_fix: best.fix,
      headline: `${best.fix.name} looks like the closest fix in the vault.`,
      reasoning: `${best.fix.name} lines up with the pain you described closely enough to be worth checking before we call this a brand-new gap.`,
      next_steps: [
        `Open ${best.fix.name} and compare it to the part of the workflow that keeps wasting time.`,
        "If it solves the pain, grab it and move on. If not, we'll review the PMO as a build candidate.",
      ],
      submission_id: submission.id,
    };
  }

  return fallbackMatch(submission.id);
}

async function queueMatchResultEmail(submission: EmailSubmission, result: MatchResult): Promise<void> {
  const messageId = `match-result-${submission.id}`;

  try {
    if (!submission.email) throw new Error("Submission email is missing");

    const recipientEmail = submission.email;
    const normalizedEmail = recipientEmail.toLowerCase();
    const idempotencyKey = messageId;
    const { data: existingSend, error: existingSendError } = await supabaseAdmin
      .from("email_send_log")
      .select("id, status")
      .eq("message_id", messageId)
      .in("status", ["pending", "sent", "suppressed"])
      .limit(1);
    if (existingSendError) throw existingSendError;
    if (existingSend?.length) return;

    const { data: suppressed, error: suppressionError } = await supabaseAdmin
      .from("suppressed_emails")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (suppressionError) throw suppressionError;

    if (suppressed) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "match-result",
        recipient_email: recipientEmail,
        status: "suppressed",
      });
      return;
    }

    const { data: existingToken, error: tokenLookupError } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (tokenLookupError) throw tokenLookupError;

    if (existingToken?.used_at) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "match-result",
        recipient_email: recipientEmail,
        status: "suppressed",
        error_message: "Unsubscribe token already used",
      });
      return;
    }

    let unsubscribeToken = existingToken && !existingToken.used_at ? existingToken.token : null;
    if (!unsubscribeToken) {
      unsubscribeToken = generateEmailToken();
      const { error: tokenError } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: "email", ignoreDuplicates: true });
      if (tokenError) throw tokenError;
      const { data: storedToken, error: reReadError } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (reReadError || !storedToken) throw reReadError ?? new Error("Missing unsubscribe token");
      unsubscribeToken = storedToken.token;
    }

    const matchedFix = result.matched_fix;
    const templateData = {
      firstName: submission.first_name ?? undefined,
      verdict: result.verdict,
      headline: result.headline,
      reasoning: result.reasoning,
      nextSteps: result.next_steps,
      matchedFix: matchedFix
        ? {
            name: matchedFix.name,
            summary: matchedFix.summary,
            url: matchedFix.url || undefined,
            price_note: matchedFix.price_note || undefined,
          }
        : result.external_recommendation?.name
          ? {
              name: result.external_recommendation.name,
              summary: result.external_recommendation.why || "This is the closest practical recommendation for the PMO you described.",
              url: result.external_recommendation.url || undefined,
            }
          : null,
      problemPreview: submission.description.length > 240 ? submission.description.slice(0, 237) + "..." : submission.description,
    };
    const html = renderMatchEmailHtml(templateData);
    const text = renderMatchEmailText(templateData);
    const subject = `PMOfix: ${result.headline}`;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "match-result",
      recipient_email: recipientEmail,
      status: "pending",
    });

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipientEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "match-result",
        idempotency_key: idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "match-result",
        recipient_email: recipientEmail,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      throw enqueueError;
    }

    console.log("Match result email enqueued for", recipientEmail);
  } catch (err) {
    console.error("Failed to dispatch match result email", err);
    if (submission.email) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "match-result",
        recipient_email: submission.email,
        status: "failed",
        error_message: errorMessage(err).slice(0, 500),
      });
    }
  }
}

export const submitAndMatch = createServerFn({ method: "POST" })
  .inputValidator((input) => SubmissionInputSchema.parse(input))
  .handler(async ({ data }): Promise<MatchResult> => {
    try {
      return await runSubmitAndMatch(data);
    } catch (err) {
      // TanStack serializes thrown errors with seroval; Supabase / fetch / AI
      // SDK errors often contain non-serializable fields (Headers, Request,
      // circular refs) which makes the client see an opaque "Seroval Error"
      // and the real cause never reaches worker logs. Log the full original
      // here and rethrow a plain Error with a safe string message.
      console.error("submitAndMatch failed:", err);
      throw new Error(errorMessage(err));
    }
  });

type SubmissionRow = {
  id: string;
  description: string;
  email: string | null;
  first_name: string | null;
  category: string | null;
  platforms: string[] | null;
  platforms_other: string | null;
  frequency: string | null;
  cost_impact: string | null;
  dream_fix: string | null;
  work_type: string | null;
  user_id: string | null;
  match_result: unknown;
  matched_at: string | null;
};

/**
 * Upsert a partial draft of a submission. Used by the staged-funnel flow
 * (steps 1-4) so each step can persist what the user has answered so far
 * without requiring all fields up front.
 */
export async function upsertDraft(
  input: z.infer<typeof DraftInputSchema>,
): Promise<{ id: string }> {
  const id = input.id ?? crypto.randomUUID();
  const payload: Record<string, unknown> = { id };

  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.email !== undefined) payload.email = input.email.trim();
  if (input.category !== undefined) payload.category = input.category;
  if (input.platforms !== undefined) payload.platforms = input.platforms?.length ? input.platforms : null;
  if (input.platforms_other !== undefined) payload.platforms_other = input.platforms_other?.trim() || null;
  if (input.frequency !== undefined) payload.frequency = input.frequency;
  if (input.cost_impact !== undefined) payload.cost_impact = input.cost_impact;
  if (input.dream_fix !== undefined) payload.dream_fix = input.dream_fix?.trim() || null;
  if (input.first_name !== undefined) payload.first_name = input.first_name?.trim() || null;
  if (input.work_type !== undefined) payload.work_type = input.work_type;
  if (input.user_id !== undefined) payload.user_id = input.user_id;

  // First insert of a brand-new row needs description (NOT NULL).
  if (!input.id && !input.description) {
    throw new Error("Description is required for the initial draft");
  }

  const { error } = await withTimeout(
    supabaseAdmin.from("pmo_submissions").upsert(payload, { onConflict: "id" }),
    10_000,
    "Saving draft",
  );
  if (error) {
    console.error("upsertDraft failed:", error);
    throw new Error(error.message);
  }
  return { id };
}

async function loadSubmission(id: string): Promise<SubmissionRow> {
  const { data, error } = await withTimeout(
    supabaseAdmin.from("pmo_submissions").select("*").eq("id", id).single(),
    10_000,
    "Loading submission",
  );
  if (error || !data) {
    throw new Error(error?.message ?? "Submission not found");
  }
  return data as SubmissionRow;
}

/**
 * Core matcher. Takes an already-persisted submission row, runs the AI match,
 * writes the result back to `match_result` with the given stage, and optionally
 * queues the result email.
 */
async function runMatchInner(
  submission: SubmissionRow,
  opts: { stage: "prematch" | "final"; sendEmail: boolean },
): Promise<MatchResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.error("Missing LOVABLE_API_KEY — returning manual-match fallback");
    const fallback: MatchResult = { ...fallbackMatch(submission.id), stage: opts.stage };
    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: fallback, matched_at: new Date().toISOString() })
      .eq("id", submission.id);
    if (opts.sendEmail) await queueMatchResultEmail(submission, fallback);
    return fallback;
  }

  const { data: fixes, error: fixErr } = await withTimeout(
    supabaseAdmin
      .from("fixes")
      .select("id, name, type, summary, description, url, categories, platforms, tags, price_note, image_url")
      .eq("active", true),
    10_000,
    "Loading fixes",
  );
  if (fixErr) throw new Error(fixErr.message);

  const catalog: CatalogFix[] = (fixes ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    summary: f.summary,
    description: f.description ?? "",
    categories: f.categories ?? [],
    platforms: f.platforms ?? [],
    tags: f.tags ?? [],
    url: f.url ?? "",
    price_note: f.price_note ?? "",
    image_url: f.image_url ?? "",
  }));

  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-2.5-flash");

  const system = `You are the PMOfix matching engine. PMO = "Pisses Me Off" — a user-reported workflow problem.
Your job: get the user a real solution as fast as possible. In priority order:

1. INTERNAL CATALOG MATCH — if our catalog has a fix that directly solves this, verdict = "match" and set matched_fix_id.
2. INTERNAL CATALOG ADJACENT — if our catalog has something that partially helps, verdict = "recommended" and set matched_fix_id.
3. EXTERNAL TOOL — if nothing in our catalog fits but a well-known third-party product/service/tool DOES solve this (e.g. Zapier, Make, Descript, Notion, Calendly, Loom, Fathom, Castmagic, etc.), verdict = "recommended", matched_fix_id = null, and fill external_recommendation with { name, url (best guess to the product homepage, or null), why }. Only recommend tools you're confident actually exist and actually do this.
4. GAP — if nothing internal AND no good external tool genuinely solves this, verdict = "gap", matched_fix_id = null, external_recommendation = null. This is a great outcome — it's a build candidate for us. Be honest; don't force a recommendation.

Other rules:
- headline: punchy 1-line verdict in PMOfix voice (direct, slightly irreverent, no fluff, no emoji spam). Max 200 chars.
- reasoning: 2-4 sentences explaining the match (or gap), referencing the user's actual problem.
- next_steps: 2-4 short, concrete actions. For external recs, include trying the tool. For gaps, say something like "We're flagging this as a build candidate — we may build it."
- Never invent internal fixes. Never use a matched_fix_id that isn't in the catalog.
- Don't recommend an external tool you're not sure about. "Gap" beats a bad recommendation.

Return ONLY a JSON object with this exact shape (no markdown, no commentary):
{
  "verdict": "match" | "recommended" | "gap",
  "confidence": "low" | "medium" | "high",
  "matched_fix_id": string | null,
  "external_recommendation": { "name": string, "url": string | null, "why": string } | null,
  "headline": string,
  "reasoning": string,
  "next_steps": [string, ...]
}`;

  const userPrompt = `USER SUBMISSION:
Problem: ${submission.description}
Category: ${submission.category ?? "(none)"}
Platforms involved: ${(submission.platforms ?? []).join(", ") || "(none specified)"}
Other platforms: ${submission.platforms_other ?? "(none)"}
Frequency: ${submission.frequency ?? "(unspecified)"}
Cost/impact: ${submission.cost_impact ?? "(unspecified)"}
Dream fix: ${submission.dream_fix ?? "(none described)"}
Work type: ${submission.work_type ?? "(unspecified)"}

FIX CATALOG (${catalog.length} active):
${catalog.length === 0 ? "(empty — no fixes in catalog yet, so verdict MUST be 'gap')" : JSON.stringify(catalog, null, 2)}

Pick the best match or declare a gap.`;

  const aiAbort = AbortSignal.timeout(45_000);
  let output: z.infer<typeof MatchSchema>;
  try {
    const res = await generateObject({
      model,
      schema: MatchSchema,
      system,
      prompt: userPrompt,
      abortSignal: aiAbort,
    });
    output = res.object;
  } catch (structErr) {
    console.error("generateObject failed, falling back to generateText:", errorMessage(structErr));
    try {
      const textRes = await generateText({
        model,
        system,
        prompt: userPrompt,
        abortSignal: aiAbort,
      });
      const parsed = extractJsonObject(textRes.text.trim());
      output = MatchSchema.parse(parsed);
    } catch (textErr) {
      const msg = errorMessage(textErr);
      console.error("AI match failed (text fallback also failed), using deterministic backup:", msg, textErr);
      const fallback: MatchResult = {
        ...deterministicBackupMatch(submission, catalog),
        stage: opts.stage,
      };
      await supabaseAdmin
        .from("pmo_submissions")
        .update({ match_result: fallback, matched_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (opts.sendEmail) await queueMatchResultEmail(submission, fallback);
      return fallback;
    }
  }

  if (output.verdict === "gap") {
    const backup = deterministicBackupMatch(submission, catalog);
    if (backup.verdict !== "gap") {
      output = {
        verdict: backup.verdict,
        confidence: backup.confidence,
        matched_fix_id: backup.matched_fix_id,
        external_recommendation: backup.external_recommendation,
        headline: backup.headline,
        reasoning: backup.reasoning,
        next_steps: backup.next_steps,
      };
    }
  }

  let matchedFixId = output.matched_fix_id;
  if (matchedFixId && !catalog.find((c) => c.id === matchedFixId)) {
    matchedFixId = null;
  }
  const matchedFix = matchedFixId
    ? catalog.find((c) => c.id === matchedFixId) ?? null
    : null;
  const hasExternal = !!output.external_recommendation?.name;
  const verdict =
    !matchedFix && !hasExternal
      ? "gap"
      : output.verdict ?? (hasExternal ? "recommended" : "match");

  const result: MatchResult = {
    ...output,
    verdict,
    confidence: output.confidence ?? "medium",
    matched_fix_id: matchedFixId,
    matched_fix: matchedFix,
    headline: output.headline || (matchedFix ? `${matchedFix.name} looks like your best fix.` : "We found a fix worth trying."),
    reasoning: output.reasoning || (matchedFix ? `${matchedFix.name} maps to the pain you described and is the closest fit in the PMOfix vault.` : "We found a practical recommendation for this PMO."),
    next_steps: normalizeSteps(output.next_steps).length
      ? normalizeSteps(output.next_steps)
      : matchedFix
        ? [`Open ${matchedFix.name} and compare it against the workflow that keeps breaking.`, "If it solves the pain, grab the fix and move on."]
        : ["Try the recommended fix and see if it removes the recurring pain.", "If it misses, reply to the email and we'll review it manually."],
    submission_id: submission.id,
    stage: opts.stage,
  };

  await supabaseAdmin
    .from("pmo_submissions")
    .update({ match_result: result, matched_at: new Date().toISOString() })
    .eq("id", submission.id);

  if (opts.sendEmail) await queueMatchResultEmail(submission, result);

  return result;
}

/** Run a background "prematch" pass on the current state of a submission. */
export async function runPrematch(id: string): Promise<MatchResult> {
  const submission = await loadSubmission(id);
  return runMatchInner(submission, { stage: "prematch", sendEmail: false });
}

/**
 * Finalize a submission: if a fresh prematch result is already cached and the
 * user didn't add a dream_fix afterward, reuse it (just stamp + email).
 * Otherwise re-run the AI with the full context.
 */
export async function runFinalize(id: string): Promise<MatchResult> {
  const submission = await loadSubmission(id);
  const cached = submission.match_result as MatchResult | null;

  const canReuse =
    cached &&
    cached.stage === "prematch" &&
    cached.submission_id === submission.id &&
    !submission.dream_fix; // dream_fix wasn't in prematch input — re-run if present

  if (canReuse) {
    const finalResult: MatchResult = { ...cached, stage: "final" };
    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: finalResult, matched_at: new Date().toISOString() })
      .eq("id", submission.id);
    await queueMatchResultEmail(submission, finalResult);
    return finalResult;
  }

  return runMatchInner(submission, { stage: "final", sendEmail: true });
}

/** Legacy one-shot path: insert all fields + match + email in a single call. */
export async function runSubmitAndMatch(
  data: z.infer<typeof SubmissionInputSchema>,
): Promise<MatchResult> {
  const { id } = await upsertDraft(data);
  const submission = await loadSubmission(id);
  return runMatchInner(submission, { stage: "final", sendEmail: true });
}


  const { data: submission, error: insErr } = await withTimeout(
    supabaseAdmin
      .from("pmo_submissions")
      .upsert(submissionPayload, { onConflict: "id" })
      .select()
      .single(),
    10_000,
    "Saving submission",
  );
  if (insErr || !submission) {
    console.error("pmo_submissions upsert failed:", insErr);
    throw new Error(insErr?.message ?? "Failed to save submission");
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    // Submission is saved; downgrade gracefully so the user doesn't get a 500.
    console.error("Missing LOVABLE_API_KEY — returning manual-match fallback");
    const fallback = fallbackMatch(submission.id);
    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: fallback, matched_at: new Date().toISOString() })
      .eq("id", submission.id);
    await queueMatchResultEmail(submission, fallback);
    return fallback;
  }

    // 2. Load active fix catalog
    const { data: fixes, error: fixErr } = await withTimeout(
      supabaseAdmin
        .from("fixes")
        .select("id, name, type, summary, description, url, categories, platforms, tags, price_note, image_url")
        .eq("active", true),
      10_000,
      "Loading fixes",
    );
    if (fixErr) throw new Error(fixErr.message);

    const catalog = (fixes ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      summary: f.summary,
      description: f.description ?? "",
      categories: f.categories ?? [],
      platforms: f.platforms ?? [],
      tags: f.tags ?? [],
      url: f.url ?? "",
      price_note: f.price_note ?? "",
      image_url: f.image_url ?? "",
    }));

    // 3. Ask the AI to match
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const system = `You are the PMOfix matching engine. PMO = "Pisses Me Off" — a user-reported workflow problem.
Your job: get the user a real solution as fast as possible. In priority order:

1. INTERNAL CATALOG MATCH — if our catalog has a fix that directly solves this, verdict = "match" and set matched_fix_id.
2. INTERNAL CATALOG ADJACENT — if our catalog has something that partially helps, verdict = "recommended" and set matched_fix_id.
3. EXTERNAL TOOL — if nothing in our catalog fits but a well-known third-party product/service/tool DOES solve this (e.g. Zapier, Make, Descript, Notion, Calendly, Loom, Fathom, Castmagic, etc.), verdict = "recommended", matched_fix_id = null, and fill external_recommendation with { name, url (best guess to the product homepage, or null), why }. Only recommend tools you're confident actually exist and actually do this.
4. GAP — if nothing internal AND no good external tool genuinely solves this, verdict = "gap", matched_fix_id = null, external_recommendation = null. This is a great outcome — it's a build candidate for us. Be honest; don't force a recommendation.

Other rules:
- headline: punchy 1-line verdict in PMOfix voice (direct, slightly irreverent, no fluff, no emoji spam). Max 200 chars.
- reasoning: 2-4 sentences explaining the match (or gap), referencing the user's actual problem.
- next_steps: 2-4 short, concrete actions. For external recs, include trying the tool. For gaps, say something like "We're flagging this as a build candidate — we may build it."
- Never invent internal fixes. Never use a matched_fix_id that isn't in the catalog.
- Don't recommend an external tool you're not sure about. "Gap" beats a bad recommendation.

Return ONLY a JSON object with this exact shape (no markdown, no commentary):
{
  "verdict": "match" | "recommended" | "gap",
  "confidence": "low" | "medium" | "high",
  "matched_fix_id": string | null,
  "external_recommendation": { "name": string, "url": string | null, "why": string } | null,
  "headline": string,
  "reasoning": string,
  "next_steps": [string, ...]
}`;

    const userPrompt = `USER SUBMISSION:
Problem: ${submission.description}
Category: ${submission.category ?? "(none)"}
Platforms involved: ${(submission.platforms ?? []).join(", ") || "(none specified)"}
Other platforms: ${submission.platforms_other ?? "(none)"}
Frequency: ${submission.frequency ?? "(unspecified)"}
Cost/impact: ${submission.cost_impact ?? "(unspecified)"}
Dream fix: ${submission.dream_fix ?? "(none described)"}
Work type: ${submission.work_type ?? "(unspecified)"}

FIX CATALOG (${catalog.length} active):
${catalog.length === 0 ? "(empty — no fixes in catalog yet, so verdict MUST be 'gap')" : JSON.stringify(catalog, null, 2)}

Pick the best match or declare a gap.`;

    const aiAbort = AbortSignal.timeout(45_000);
    let output: z.infer<typeof MatchSchema>;
    try {
      // Try structured output first.
      const res = await generateObject({
        model,
        schema: MatchSchema,
        system,
        prompt: userPrompt,
        abortSignal: aiAbort,
      });
      output = res.object;
    } catch (structErr) {
      // Schema or provider error — retry with plain text + manual JSON parse.
      // Gemini's structured-output mode is brittle; freeform JSON is far more
      // reliable as long as we extract and validate ourselves.
      console.error("generateObject failed, falling back to generateText:", errorMessage(structErr));
      try {
        const textRes = await generateText({
          model,
          system,
          prompt: userPrompt,
          abortSignal: aiAbort,
        });
        const raw = textRes.text.trim();
        // Strip ```json fences if present
        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        // Grab the largest {...} block to be safe
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        const jsonStr = firstBrace >= 0 && lastBrace > firstBrace
          ? cleaned.slice(firstBrace, lastBrace + 1)
          : cleaned;
        const parsed = JSON.parse(jsonStr);
        output = MatchSchema.parse(parsed);
      } catch (textErr) {
        const msg = errorMessage(textErr);
        console.error("AI match failed (text fallback also failed), using deterministic backup:", msg, textErr);
        const fallback = deterministicBackupMatch(submission, catalog);
        await supabaseAdmin
          .from("pmo_submissions")
          .update({ match_result: fallback, matched_at: new Date().toISOString() })
          .eq("id", submission.id);
        await queueMatchResultEmail(submission, fallback);
        return fallback;
      }
    }

    // If AI declares a gap, do one deterministic pass for obvious known
    // external fixes before showing the user the build-board message.
    if (output.verdict === "gap") {
      const backup = deterministicBackupMatch(submission, catalog);
      if (backup.verdict !== "gap") {
        output = {
          verdict: backup.verdict,
          confidence: backup.confidence,
          matched_fix_id: backup.matched_fix_id,
          external_recommendation: backup.external_recommendation,
          headline: backup.headline,
          reasoning: backup.reasoning,
          next_steps: backup.next_steps,
        };
      }
    }

    // Validate matched_fix_id actually exists in catalog
    let matchedFixId = output.matched_fix_id;
    if (matchedFixId && !catalog.find((c) => c.id === matchedFixId)) {
      matchedFixId = null;
    }
    const matchedFix = matchedFixId
      ? catalog.find((c) => c.id === matchedFixId) ?? null
      : null;
    const hasExternal = !!output.external_recommendation?.name;
    const verdict =
      !matchedFix && !hasExternal
        ? "gap"
        : output.verdict ?? (hasExternal ? "recommended" : "match");

    const result: MatchResult = {
      ...output,
      verdict,
      confidence: output.confidence ?? "medium",
      matched_fix_id: matchedFixId,
      matched_fix: matchedFix,
      headline: output.headline || (matchedFix ? `${matchedFix.name} looks like your best fix.` : "We found a fix worth trying."),
      reasoning: output.reasoning || (matchedFix ? `${matchedFix.name} maps to the pain you described and is the closest fit in the PMOfix vault.` : "We found a practical recommendation for this PMO."),
      next_steps: normalizeSteps(output.next_steps).length
        ? normalizeSteps(output.next_steps)
        : matchedFix
          ? [`Open ${matchedFix.name} and compare it against the workflow that keeps breaking.`, "If it solves the pain, grab the fix and move on."]
          : ["Try the recommended fix and see if it removes the recurring pain.", "If it misses, reply to the email and we'll review it manually."],
      submission_id: submission.id,
    };

    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: result, matched_at: new Date().toISOString() })
      .eq("id", submission.id);

    await queueMatchResultEmail(submission, result);

  return result;
}

