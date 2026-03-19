import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const IDLE_TIMEOUT_MS     = 30 * 60 * 1000;  // 30 min idle → sign out
const WARNING_BEFORE_MS   =  2 * 60 * 1000;  // warn 2 min before
const ABSOLUTE_TIMEOUT_MS =  8 * 60 * 60 * 1000; // 8 h absolute session cap

const ACTIVITY_EVENTS = [
  "mousemove", "keydown", "mousedown",
  "scroll", "touchstart", "touchmove", "click",
] as const;

export const SESSION_TIMEOUT_KEY = "session_timed_out";

export function useSessionTimeout(enabled: boolean) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  const warnTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absoluteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef      = useRef<() => void>(() => {});

  const clearIdleTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    warnTimer.current = idleTimer.current = null;
  }, []);

  const clearAll = useCallback(() => {
    clearIdleTimers();
    if (absoluteTimer.current) clearTimeout(absoluteTimer.current);
    absoluteTimer.current = null;
  }, [clearIdleTimers]);

  const doSignOut = useCallback(async (reason: "idle" | "absolute") => {
    console.info(`[Session] Signing out — reason: ${reason}`);
    clearAll();
    setShowWarning(false);
    await supabase.auth.signOut();
    sessionStorage.setItem(SESSION_TIMEOUT_KEY, reason);
    navigate("/login");
  }, [clearAll, navigate]);

  useEffect(() => {
    resetRef.current = () => {
      if (!enabled) return;
      clearIdleTimers();
      setShowWarning(false);
      warnTimer.current = setTimeout(() => setShowWarning(true), IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
      idleTimer.current = setTimeout(() => doSignOut("idle"), IDLE_TIMEOUT_MS);
    };
  }, [enabled, clearIdleTimers, doSignOut]);

  useEffect(() => {
    if (!enabled) { clearAll(); setShowWarning(false); return; }

    const handler = () => resetRef.current();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetRef.current();

    // Absolute session cap — once per mount, cannot be reset by activity
    absoluteTimer.current = setTimeout(() => doSignOut("absolute"), ABSOLUTE_TIMEOUT_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler));
      clearAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const stayLoggedIn = useCallback(() => { resetRef.current(); }, []);

  return { showWarning, stayLoggedIn };
}
