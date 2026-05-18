import { createFileRoute } from "@tanstack/react-router";
import { runSubmitAndMatch } from "@/lib/match.functions";

export const Route = createFileRoute("/api/public/match")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            return Response.json({ error: "Expected JSON" }, { status: 415 });
          }

          const payload = await request.json();
          const result = await runSubmitAndMatch(payload);
          return Response.json(result);
        } catch (error) {
          console.error("public match submission failed:", error);
          const message = error instanceof Error ? error.message : "Submission failed";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});