import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getAccessToken(): Promise<string> {
  const CLIENT_ID = process.env.AWEBER_CLIENT_ID;
  const CLIENT_SECRET = process.env.AWEBER_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("AWeber credentials not configured (AWEBER_CLIENT_ID / AWEBER_CLIENT_SECRET).");
  }

  const { data: row } = await supabaseAdmin
    .from("aweber_settings")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", "default")
    .maybeSingle();

  if (!row?.refresh_token) {
    throw new Error("AWeber not connected. Run the AWeber OAuth setup first.");
  }

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) {
    return row.access_token as string;
  }

  const res = await fetch("https://auth.aweber.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token as string,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`AWeber token refresh failed: ${JSON.stringify(data)}`);

  await supabaseAdmin.from("aweber_settings").upsert(
    {
      id: "default",
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return data.access_token as string;
}

async function getAccountId(token: string): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("aweber_settings")
    .select("account_id")
    .eq("id", "default")
    .maybeSingle();
  if (row?.account_id) return row.account_id as string;

  const res = await fetch("https://api.aweber.com/1.0/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`AWeber accounts lookup failed: ${JSON.stringify(data)}`);
  const accountId = String(data.entries?.[0]?.id ?? "");
  if (!accountId) throw new Error("No AWeber account found");

  await supabaseAdmin.from("aweber_settings").update({ account_id: accountId }).eq("id", "default");
  return accountId;
}

export async function addSubscriber(opts: {
  listId: string;
  email: string;
  name?: string;
  tags?: string[];
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = await getAccessToken();
  const accountId = await getAccountId(token);

  // AWeber list IDs come in as e.g. "awlist6955110" — strip the "awlist" prefix.
  const listIdNum = opts.listId.replace(/^awlist/, "");

  const res = await fetch(
    `https://api.aweber.com/1.0/accounts/${accountId}/lists/${listIdNum}/subscribers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: opts.email,
        name: opts.name,
        tags: opts.tags && opts.tags.length ? opts.tags : undefined,
        update_existing: true,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function getListIdForProduct(
  productId: string,
): Promise<{ listId: string; tag: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("aweber_list_map")
    .select("list_id, tag")
    .eq("product_id", productId)
    .maybeSingle();
  if (!data) return null;
  return { listId: data.list_id as string, tag: (data.tag as string) ?? null };
}
