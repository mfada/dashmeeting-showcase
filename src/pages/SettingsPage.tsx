import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOffice365Integration, useDisconnectOffice365 } from "@/hooks/useOffice365";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";

const MS_SCOPES = [
  "openid", "email", "profile",
  "User.Read", "Mail.Read",
  "Calendars.Read", "Calendars.ReadWrite",
  "offline_access",
].join(" ");

function MicrosoftLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: integration, isLoading: integrationLoading } = useOffice365Integration();
  const disconnect = useDisconnectOffice365();

  // Show success toast when returning from Microsoft OAuth
  useEffect(() => {
    if (searchParams.get("integration") === "success") {
      toast.success(t.office365.connectedSuccess);
      qc.invalidateQueries({ queryKey: ["office365-integration"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      navigate("/settings", { replace: true });
    }
  }, [searchParams, qc, navigate, t]);

  const connectOffice365 = () => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      toast.error("VITE_MICROSOFT_CLIENT_ID is not set. Add it to your .env.local file.");
      return;
    }
    // Generate and store CSRF state
    const state = crypto.randomUUID();
    sessionStorage.setItem("o365_oauth_state", state);

    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/office365/callback`);
    const scope = encodeURIComponent(MS_SCOPES);
    const url =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}` +
      `&response_mode=query` +
      `&state=${state}`;
    window.location.href = url;
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-office365", { body: {} });
      if (error) throw error;
      toast.success(t.calendar.syncSuccess);
      qc.invalidateQueries({ queryKey: ["office365-integration"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["calendar-data"] });
    } catch (err: any) {
      toast.error(err.message || t.calendar.syncError);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success(t.office365.disconnectedSuccess);
    } catch (err: any) {
      toast.error(err.message || t.common.error);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      {/* Office 365 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MicrosoftLogo />
            {t.office365.title}
          </CardTitle>
          <CardDescription>{t.office365.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {integrationLoading ? (
            <div className="h-16 flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">{t.common.loading}</span>
            </div>
          ) : integration ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {integration.display_name ?? "Office 365 Account"}
                  </p>
                  {integration.email && (
                    <p className="text-xs text-muted-foreground">{integration.email}</p>
                  )}
                  {integration.last_synced_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.office365.lastSynced}{" "}
                      {formatDistanceToNow(parseISO(integration.last_synced_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? t.calendar.syncing : t.office365.syncNow}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                  className="text-destructive hover:text-destructive hover:border-destructive"
                >
                  {t.office365.disconnect}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.office365.connectPrompt}</p>
              <Button size="sm" onClick={connectOffice365} className="gap-2">
                <MicrosoftLogo size={16} />
                {t.office365.connect}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plaud — Phase 2 scaffold (coming soon) */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            {t.plaud.title}
            <Badge variant="secondary" className="text-[10px] ml-1">{t.plaud.comingSoon}</Badge>
          </CardTitle>
          <CardDescription>{t.plaud.settingsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t.plaud.manualHint}</p>
          <Button size="sm" disabled className="gap-2 cursor-not-allowed opacity-50">
            <Mic className="h-3.5 w-3.5" />
            {t.plaud.connectButton}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
