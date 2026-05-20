import { createFileRoute } from "@tanstack/react-router";
import { DraftInputSchema, upsertDraft } from "@/lib/match.functions";

async function verifyTurnstile(token: string, remoteip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured");
    return false;
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteip) body.set("remoteip", remoteip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
    }
    return Boolean(data.success);
  } catch (err) {
    console.error("Turnstile verification request failed:", err);
    return false;
  }
}

export const Route = createFileRoute("/api/public/match/draft")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            return Response.json({ error: "Expected JSON" }, { status: 415 });
          }
          const raw = (await request.json()) as Record<string, unknown>;
          const turnstileToken = typeof raw.turnstile_token === "string" ? raw.turnstile_token : null;
          const hasExistingId = typeof raw.id === "string" && raw.id.length > 0;

          // Honeypot: real users never fill the hidden `company_website` field.
          // Bots that auto-fill every input get a fake-success response and are
          // silently dropped (never written to the DB).
          const honeypot = typeof raw.company_website === "string" ? raw.company_website.trim() : "";
          if (honeypot.length > 0) {
            console.warn("Honeypot tripped on draft endpoint");
            return Response.json({ id: "00000000-0000-0000-0000-000000000000" });
          }
          delete raw.company_website;

          // Only require Turnstile on the FIRST draft (no id yet). Subsequent
          // saves reference an existing submission and are gated by that id.
          if (!hasExistingId) {
            if (!turnstileToken) {
              return Response.json({ error: "Missing verification token" }, { status: 400 });
            }
            const remoteip =
              request.headers.get("cf-connecting-ip") ||
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              null;
            const ok = await verifyTurnstile(turnstileToken, remoteip);
            if (!ok) {
              return Response.json({ error: "Verification failed. Please try again." }, { status: 403 });
            }
          }

          delete raw.turnstile_token;
          const payload = DraftInputSchema.parse(raw);
          const result = await upsertDraft(payload);
          return Response.json(result);
        } catch (error) {
          console.error("draft submission failed:", error);
          const message = error instanceof Error ? error.message : "Draft failed";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
