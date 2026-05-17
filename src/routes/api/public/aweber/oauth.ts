import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/aweber/oauth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const CLIENT_ID = process.env.AWEBER_CLIENT_ID;
        const CLIENT_SECRET = process.env.AWEBER_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
          return Response.json(
            { error: "AWeber credentials not configured. Add AWEBER_CLIENT_ID and AWEBER_CLIENT_SECRET." },
            { status: 500 },
          );
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const redirectUri = `${url.origin}/api/public/aweber/oauth`;

        // Step 1: no code — return the authorization URL
        if (!code) {
          const scope =
            "account.read list.read list.write subscriber.read subscriber.write";
          const authUrl =
            `https://auth.aweber.com/oauth2/authorize?response_type=code` +
            `&client_id=${encodeURIComponent(CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scope)}` +
            `&state=setup`;

          return Response.json({
            message: "Register the redirectUri in your AWeber app, then visit authUrl to authorize.",
            authUrl,
            redirectUri,
          });
        }

        // Step 2: exchange code for tokens
        const tokenRes = await fetch("https://auth.aweber.com/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
          return Response.json(
            { error: "Token exchange failed", details: tokenData },
            { status: 400 },
          );
        }

        await supabaseAdmin.from("aweber_settings").upsert(
          {
            id: "default",
            refresh_token: tokenData.refresh_token,
            access_token: tokenData.access_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        return Response.json({
          message: "AWeber connected successfully! Refresh token saved.",
        });
      },
    },
  },
});
