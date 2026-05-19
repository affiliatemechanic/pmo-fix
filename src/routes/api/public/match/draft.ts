import { createFileRoute } from "@tanstack/react-router";
import { DraftInputSchema, upsertDraft } from "@/lib/match.functions";

export const Route = createFileRoute("/api/public/match/draft")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            return Response.json({ error: "Expected JSON" }, { status: 415 });
          }
          const payload = DraftInputSchema.parse(await request.json());
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
