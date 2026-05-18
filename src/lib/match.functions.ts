import * as React from "react";
import { render } from "@react-email/components";
import { createServerFn } from "@tanstack/react-start";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { template as matchResultEmailTemplate } from "@/lib/email-templates/match-result";
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

const SubmissionInputSchema = z.object({
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
};

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

async function runSubmitAndMatch(
  data: z.infer<typeof SubmissionInputSchema>,
): Promise<MatchResult> {
  // 1. Insert submission FIRST so the row is always saved, even if matching
  //    fails downstream. The catalog load + AI call run after.
  const submissionPayload = {
    ...(data.id ? { id: data.id } : {}),
    description: data.description.trim(),
    email: data.email.trim(),
    category: data.category ?? null,
    platforms: data.platforms?.length ? data.platforms : null,
    platforms_other: data.platforms_other?.trim() || null,
    frequency: data.frequency ?? null,
    cost_impact: data.cost_impact ?? null,
    dream_fix: data.dream_fix?.trim() || null,
    first_name: data.first_name?.trim() || null,
    work_type: data.work_type ?? null,
    user_id: data.user_id ?? null,
  };

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

    // Queue the result email directly. Calling our own HTTP route from a server
    // function is unreliable in the live worker runtime, so keep this in-process.
    try {
      if (!submission.email) throw new Error("Submission email is missing");
      const recipientEmail = submission.email;
      const normalizedEmail = recipientEmail.toLowerCase();
      const messageId = crypto.randomUUID();
      const idempotencyKey = `match-result-${submission.id}`;
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
      } else {
        const { data: existingToken, error: tokenLookupError } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", normalizedEmail)
          .maybeSingle();
        if (tokenLookupError) throw tokenLookupError;

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
        const element = React.createElement(matchResultEmailTemplate.component, templateData);
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const subject =
          typeof matchResultEmailTemplate.subject === "function"
            ? matchResultEmailTemplate.subject(templateData)
            : matchResultEmailTemplate.subject;

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
        if (enqueueError) throw enqueueError;
        console.log("Match result email enqueued for", submission.email);
      }
    } catch (err) {
      console.error("Failed to dispatch match result email", err);
    }

  return result;
}

