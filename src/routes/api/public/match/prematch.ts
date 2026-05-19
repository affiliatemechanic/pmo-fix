import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runPrematch } from "@/lib/match.functions";

const Schema = z.object({ id: z.string().uuid() });

export const Route = createFileRoute("/api/public/match/prematch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { id } = Schema.parse(await request.json());
          // Fire and run — caller doesn't await result, but we still return JSON.
          const result = await runPrematch(id);
          return Response.json({ ok: true, stage: result.stage });
        } catch (error) {
          console.error("prematch failed:", error);
          // Prematch failures are non-fatal — the finalize call will redo the work.
          const message = error instanceof Error ? error.message : "Prematch failed";
          return Response.json({ ok: false, error: message }, { status: 200 });
        }
      },
    },
  },
});
