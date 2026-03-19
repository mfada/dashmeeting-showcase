import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Office365Callback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      setErrorMsg(params.get("error_description") || oauthError);
      return;
    }

    if (!code) {
      setErrorMsg("No authorization code received from Microsoft.");
      return;
    }

    // Verify CSRF state
    const savedState = sessionStorage.getItem("o365_oauth_state");
    if (!savedState || state !== savedState) {
      setErrorMsg("Invalid state parameter — possible CSRF attack. Please try again.");
      return;
    }
    sessionStorage.removeItem("o365_oauth_state");

    const redirectUri = `${window.location.origin}/auth/office365/callback`;

    supabase.functions
      .invoke("exchange-office365-token", { body: { code, redirectUri } })
      .then(({ error: fnError }) => {
        if (fnError) {
          setErrorMsg(fnError.message || "Failed to exchange authorization code.");
          return;
        }
        // Fire-and-forget initial sync, then navigate
        supabase.functions
          .invoke("sync-office365", { body: {} })
          .finally(() => navigate("/settings?integration=success"));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="text-4xl">⚠️</div>
          <p className="text-base font-medium text-destructive">Connection failed</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => navigate("/settings")}
            className="text-sm text-primary underline underline-offset-2"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Connecting your Office 365 account…</p>
      </div>
    </div>
  );
}
