import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addSubscriber } from "./aweber.server";

const FREE_LIST_ID = "awlist6955110";
const FREE_TAG = "free";

export const syncSelfToAweber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email;
    if (!email) return { ok: false, skipped: "no_email" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("aweber_synced_at, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.aweber_synced_at) {
      return { ok: true, skipped: "already_synced" };
    }

    let result: { ok: boolean; status: number; body: unknown };
    try {
      result = await addSubscriber({
        listId: FREE_LIST_ID,
        email,
        name: profile?.display_name ?? undefined,
        tags: [FREE_TAG],
      });
    } catch (e) {
      console.error("aweber-sync-self error:", e);
      return { ok: false, status: 0, error: String(e) };
    }

    // 4xx is terminal (blocked / invalid / dup); 5xx leaves row unsynced for retry.
    const terminal = result.ok || (result.status >= 400 && result.status < 500);
    if (terminal) {
      await supabaseAdmin
        .from("profiles")
        .update({ aweber_synced_at: new Date().toISOString() })
        .eq("id", userId);
    }

    if (!result.ok) {
      console.warn("AWeber subscribe non-ok:", result.status, result.body);
    }

    return { ok: result.ok, status: result.status };
  });
