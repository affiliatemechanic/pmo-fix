import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway";

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

const MatchSchema = z.object({
  verdict: z.enum(["match", "recommended", "gap"]),
  confidence: z.enum(["low", "medium", "high"]),
  matched_fix_id: z.string().nullable(),
  external_recommendation: z
    .object({
      name: z.string().min(1).max(120),
      url: z.string().max(500).nullable().optional(),
      why: z.string().min(1).max(600),
    })
    .nullable()
    .optional(),
  headline: z.string().min(1).max(200),
  reasoning: z.string().min(1).max(2000),
  next_steps: z.array(z.string().min(1).max(400)).min(1).max(5),
});

export type MatchResult = z.infer<typeof MatchSchema> & {
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
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are the PMOfix matching engine. PMO = "Pisses Me Off" — a user-reported workflow problem.
Your job: get the user a real solution as fast as possible. In priority order:

1. INTERNAL CATALOG MATCH — if our catalog has a fix that directly solves this, verdict = "match" and set matched_fix_id.
2. INTERNAL CATALOG ADJACENT — if our catalog has something that partially helps, verdict = "recommended" and set matched_fix_id.
3. EXTERNAL TOOL — if nothing in our catalog fits but a well-known third-party product/service/tool DOES solve this (e.g. Zapier, Make, Descript, Notion, Calendly, Loom, Fathom, Castmagic, etc.), verdict = "recommended", matched_fix_id = null, and fill external_recommendation with { name, url (best guess to the product homepage, or null), why }. Only recommend tools you're confident actually exist and actually do this.
4. GAP — if nothing internal AND no good external tool genuinely solves this, verdict = "gap", matched_fix_id = null, external_recommendation = null. This is a great outcome — it's a build candidate for us. Be honest; don't force a recommendation.

Other rules:
- headline: punchy 1-line verdict in PMOfix voice (direct, slightly irreverent, no fluff, no emoji spam).
- reasoning: 2-4 sentences explaining the match (or gap), referencing the user's actual problem.
- next_steps: 2-4 short, concrete actions. For external recs, include trying the tool. For gaps, say something like "We're flagging this as a build candidate — we may build it."
- Never invent internal fixes. Never use a matched_fix_id that isn't in the catalog.
- Don't recommend an external tool you're not sure about. "Gap" beats a bad recommendation.`;

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
      const res = await generateText({
        model,
        system: system + "\n\nRespond with ONLY a JSON object matching this exact shape, no prose, no markdown fences:\n" + JSON.stringify({
          verdict: "match|recommended|gap",
          confidence: "low|medium|high",
          matched_fix_id: "uuid or null",
          external_recommendation: { name: "string", url: "string or null", why: "string" },
          headline: "string",
          reasoning: "string",
          next_steps: ["string"],
        }),
        prompt: userPrompt,
        abortSignal: aiAbort,
      });
      // Strip code fences if any, then parse.
      const raw = res.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(raw);
      output = MatchSchema.parse(parsed);
    } catch (err) {
      console.error("AI match failed/timeout:", errorMessage(err), err);
      // Persist a graceful fallback so the row isn't left dangling.
      const fallback = fallbackMatch(submission.id);
      await supabaseAdmin
        .from("pmo_submissions")
        .update({ match_result: fallback, matched_at: new Date().toISOString() })
        .eq("id", submission.id);
      return fallback;
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
      !matchedFix && !hasExternal && output.verdict !== "gap"
        ? "gap"
        : output.verdict;

    const result: MatchResult = {
      ...output,
      verdict,
      matched_fix_id: matchedFixId,
      matched_fix: matchedFix,
      submission_id: submission.id,
    };

    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: result, matched_at: new Date().toISOString() })
      .eq("id", submission.id);

    // Send result email — fire-and-forget, with a hard timeout so it can NEVER
    // block the response to the user. Failures are logged, not thrown.
    try {
      const origin = getRequestUrl().origin;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      void fetch(`${origin}/lovable/email/transactional/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          templateName: "match-result",
          recipientEmail: submission.email,
          idempotencyKey: `match-result-${submission.id}`,
          templateData: {
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
              : null,
            problemPreview:
              submission.description.length > 240
                ? submission.description.slice(0, 237) + "..."
                : submission.description,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch((err) => console.error("Failed to send match result email", err));
    } catch (err) {
      console.error("Failed to dispatch match result email", err);
    }

  return result;
}

