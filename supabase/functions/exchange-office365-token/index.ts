import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { code, redirectUri } = await req.json();
    if (!code) throw new Error("Missing authorization code");

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
    const redirect = redirectUri || Deno.env.get("MICROSOFT_REDIRECT_URI")!;

    // Exchange code for tokens
    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirect,
          grant_type: "authorization_code",
          scope: "openid email profile User.Read Mail.Read Calendars.Read Calendars.ReadWrite offline_access",
        }),
      }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} - ${err}`);
    }

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(`OAuth error: ${tokens.error_description ?? tokens.error}`);

    const { access_token, refresh_token, expires_in } = tokens;
    const tokenExpiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    // Fetch user info from Graph
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : {};

    // Upsert into user_integrations
    const { error: upsertErr } = await supabase
      .from("user_integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "office365",
          access_token,
          refresh_token: refresh_token ?? null,
          token_expires_at: tokenExpiresAt,
          email: me.mail ?? me.userPrincipalName ?? null,
          display_name: me.displayName ?? null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("exchange-office365-token error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
