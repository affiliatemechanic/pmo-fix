import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const InputSchema = z.object({
  submissionId: z.string().uuid(),
});

const MatchSchema = z.object({
  verdict: z.enum(["match", "recommended", "gap"]),
  confidence: z.enum(["low", "medium", "high"]),
  matched_fix_id: z.string().nullable(),
  headline: z.string().min(1).max(200),
  reasoning: z.string().min(1).max(2000),
  next_steps: z.array(z.string().min(1).max(400)).min(1).max(5),
});

export type MatchResult = z.infer<typeof MatchSchema>;

export const matchSubmission = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: submission, error: subErr } = await supabaseAdmin
      .from("pmo_submissions")
      .select("*")
      .eq("id", data.submissionId)
      .single();
    if (subErr || !submission) throw new Error("Submission not found");

    const { data: fixes, error: fixErr } = await supabaseAdmin
      .from("fixes")
      .select("id, name, type, summary, description, url, categories, platforms, tags, price_note")
      .eq("active", true);
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
    }));

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are the PMOfix matching engine. PMO = "Pisses Me Off" — a user-reported workflow problem.
You receive a user's PMO submission and a catalog of known fixes (internal products, recommended tools, affiliate offers).
Pick the single best matching fix from the catalog, or declare a gap. Be honest. If nothing genuinely fits, return "gap".

Rules:
- "match" = catalog has a fix that directly solves THIS problem. Set matched_fix_id.
- "recommended" = catalog has a fix that partially helps or is adjacent but not exact. Set matched_fix_id.
- "gap" = nothing in the catalog meaningfully addresses this. matched_fix_id = null. This becomes a candidate to build.
- headline: punchy 1-line verdict in PMOfix voice (direct, slightly irreverent, no fluff).
- reasoning: 2-4 sentences explaining the match (or gap) referencing the user's actual problem.
- next_steps: 2-4 short, concrete actions the user (or our team) should take next.
- Never invent fixes that aren't in the catalog.`;

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
${catalog.length === 0 ? "(empty — no fixes in catalog yet, so verdict must be 'gap')" : JSON.stringify(catalog, null, 2)}

Pick the best match or declare a gap.`;

    const { output } = await generateText({
      model,
      system,
      prompt: userPrompt,
      output: Output.object({ schema: MatchSchema }),
    });

    // Validate matched_fix_id exists in catalog
    if (output.matched_fix_id && !catalog.find((c) => c.id === output.matched_fix_id)) {
      output.matched_fix_id = null;
      if (output.verdict !== "gap") output.verdict = "gap";
    }

    const matchedFix = output.matched_fix_id
      ? catalog.find((c) => c.id === output.matched_fix_id) ?? null
      : null;

    const result = { ...output, matched_fix: matchedFix };

    await supabaseAdmin
      .from("pmo_submissions")
      .update({ match_result: result, matched_at: new Date().toISOString() })
      .eq("id", submission.id);

    return result;
  });
