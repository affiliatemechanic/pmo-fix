import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DraftInputSchema, runFinalize, upsertDraft } from "@/lib/match.functions";

const Schema = DraftInputSchema.extend({ id: z.string().uuid() });

export const Route = createFileRoute("/api/public/match/finalize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            return Response.json({ error: "Expected JSON" }, { status: 415 });
          }
          const payload = Schema.parse(await request.json());
          // Persist any final-step fields the client sent, then finalize.
          await upsertDraft(payload);
          const result = await runFinalize(payload.id);
          return Response.json(result);
        } catch (error) {
          console.error("finalize failed:", error);
          const message = error instanceof Error ? error.message : "Finalize failed";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
