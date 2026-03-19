import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "openid email profile User.Read Calendars.Read Calendars.ReadWrite offline_access",
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Refresh error: ${data.error_description ?? data.error}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    // Use service role to read/write all integrations (needed for cron job)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Also create a user-scoped client to identify the caller when not from cron
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

    // Parse optional userId from body (for on-demand sync by a specific user)
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.userId ?? null;
    } catch {
      // cron calls may send empty body
    }

    // If no explicit userId, try to get from JWT (user-initiated sync)
    if (!targetUserId) {
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) targetUserId = user.id;
    }

    // Build query for active integrations
    let query = supabaseAdmin
      .from("user_integrations")
      .select("*")
      .eq("provider", "office365")
      .eq("is_active", true);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: integrations, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const now = new Date();
    let totalSynced = 0;

    for (const integration of integrations ?? []) {
      try {
        let accessToken: string = integration.access_token;

        // Check expiry with a 5-minute buffer
        const expiresAt = integration.token_expires_at
          ? new Date(integration.token_expires_at)
          : null;
        const isExpired =
          !expiresAt || expiresAt.getTime() < now.getTime() + 5 * 60 * 1000;

        if (isExpired) {
          if (!integration.refresh_token) {
            await supabaseAdmin
              .from("user_integrations")
              .update({ is_active: false })
              .eq("id", integration.id);
            continue;
          }
          try {
            const refreshed = await refreshAccessToken(
              clientId,
              clientSecret,
              integration.refresh_token
            );
            accessToken = refreshed.access_token;
            const newExpiry = new Date(
              Date.now() + (refreshed.expires_in ?? 3600) * 1000
            ).toISOString();
            await supabaseAdmin
              .from("user_integrations")
              .update({
                access_token: accessToken,
                refresh_token: refreshed.refresh_token ?? integration.refresh_token,
                token_expires_at: newExpiry,
                updated_at: now.toISOString(),
              })
              .eq("id", integration.id);
          } catch (refreshErr) {
            console.error(
              `Token refresh failed for user ${integration.user_id}:`,
              refreshErr
            );
            await supabaseAdmin
              .from("user_integrations")
              .update({ is_active: false })
              .eq("id", integration.id);
            continue;
          }
        }

        // Fetch events from Microsoft Graph
        const graphUrl =
          `https://graph.microsoft.com/v1.0/me/events` +
          `?$select=id,subject,start,end,location` +
          `&$orderby=start/dateTime` +
          `&$top=100`;

        const graphRes = await fetch(graphUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!graphRes.ok) {
          const errText = await graphRes.text();
          console.error(
            `Graph API error for user ${integration.user_id}: ${graphRes.status} - ${errText}`
          );
          continue;
        }

        const graphData = await graphRes.json();
        const events: any[] = graphData.value ?? [];

        for (const ev of events) {
          // Microsoft returns dateTime in the event's timezone; append Z only if UTC
          const tzStart = ev.start?.timeZone ?? "UTC";
          const tzEnd = ev.end?.timeZone ?? "UTC";
          const startTime = ev.start?.dateTime
            ? new Date(
                ev.start.dateTime + (tzStart === "UTC" ? "Z" : "")
              ).toISOString()
            : now.toISOString();
          const endTime = ev.end?.dateTime
            ? new Date(
                ev.end.dateTime + (tzEnd === "UTC" ? "Z" : "")
              ).toISOString()
            : now.toISOString();

          const { error } = await supabaseAdmin
            .from("calendar_events")
            .upsert(
              {
                user_id: integration.user_id,
                title: ev.subject || "No title",
                start_time: startTime,
                end_time: endTime,
                location: ev.location?.displayName || null,
                source: "office365",
                external_id: ev.id,
              },
              { onConflict: "user_id,external_id" }
            );
          if (!error) totalSynced++;
        }

        // Update last_synced_at
        await supabaseAdmin
          .from("user_integrations")
          .update({ last_synced_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", integration.id);
      } catch (userErr: any) {
        console.error(`Error syncing user ${integration.user_id}:`, userErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: totalSynced, users: (integrations ?? []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-office365 error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
