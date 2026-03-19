import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_TIMEOUT_KEY } from "@/hooks/useSessionTimeout";
import { Loader2 } from "lucide-react";
import DashMeetingLogo from "@/assets/dashmeeting-logo.svg";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_TIMEOUT_KEY)) {
      sessionStorage.removeItem(SESSION_TIMEOUT_KEY);
      toast({
        title: "Signed out due to inactivity",
        description: "You were signed out after 20 minutes of inactivity.",
        variant: "destructive",
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "forgot") {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
      setLoading(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password reset email sent", description: "Check your inbox for a link to reset your password." });
        setMode("signin");
        setEmail("");
      }
      return;
    }

    if (mode === "signup") {
      const { error } = await signUp(email, password, fullName);
      setLoading(false);
      if (error) {
        toast({ title: t.login.signUpFailed, description: error.message, variant: "destructive" });
      } else {
        toast({ title: t.login.checkEmail, description: t.login.confirmationLink });
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast({ title: t.login.signInFailed, description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-[#060D1A]" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(20,184,166,0.07) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(20,184,166,0.07) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }} />
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />

        {/* Logo + name */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={DashMeetingLogo} alt="DashMeeting" className="h-10 w-10" />
          <span className="text-white text-xl font-bold tracking-tight">DashMeeting</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-400 text-xs font-medium tracking-widest uppercase">Meeting Intelligence</span>
          </div>
          <h1 className="text-white font-bold leading-[1.1] mb-4"
            style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", letterSpacing: "-0.02em" }}>
            Turn meetings<br />
            <span style={{ background: "linear-gradient(135deg, #14B8A6, #3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              into momentum
            </span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Automatically extract action items, track progress across projects, and never lose a decision to the void again.
          </p>
        </div>

        {/* Stats row */}
        <div className="relative z-10 flex gap-8">
          {[
            { value: "8", label: "Meetings ingested" },
            { value: "17", label: "Tasks tracked" },
            { value: "3", label: "Active projects" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>{value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className={`flex flex-col justify-center w-full lg:w-1/2 px-8 py-12 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        style={{ background: "linear-gradient(160deg, #0B1525 0%, #060D1A 100%)" }}>
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img src={DashMeetingLogo} alt="DashMeeting" className="h-9 w-9" />
            <span className="text-white text-lg font-bold">DashMeeting</span>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-white text-2xl font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
              {mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Welcome back"}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === "signup"
                ? "Start tracking your meeting intelligence"
                : mode === "forgot"
                  ? "Enter your email to receive a reset link"
                  : "Sign in to your workspace"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs font-medium tracking-wider uppercase">{t.login.fullName}</Label>
                <Input
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-teal-500/50 focus:ring-teal-500/20 rounded-xl"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs font-medium tracking-wider uppercase">{t.login.email}</Label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-teal-500/50 focus:ring-teal-500/20 rounded-xl"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-400 text-xs font-medium tracking-wider uppercase">{t.login.password}</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-teal-400 text-xs hover:text-teal-300 transition-colors"
                      onClick={() => { setMode("forgot"); setPassword(""); }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-teal-500/50 focus:ring-teal-500/20 rounded-xl"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-sm tracking-wide mt-2"
              style={{
                background: loading ? "rgba(20,184,166,0.5)" : "linear-gradient(135deg, #14B8A6, #0E9F8E)",
                border: "none",
                color: "#fff",
                boxShadow: loading ? "none" : "0 0 20px rgba(20,184,166,0.35)",
                transition: "all 0.2s ease",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.login.pleaseWait}
                </span>
              ) : mode === "forgot" ? "Send reset email"
                : mode === "signup" ? t.login.signUp
                  : t.login.signIn}
            </Button>
          </form>

          {/* Footer link */}
          <div className="mt-6 text-center">
            {mode === "forgot" ? (
              <button type="button" className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
                onClick={() => setMode("signin")}>
                ← Back to sign in
              </button>
            ) : (
              <p className="text-slate-500 text-sm">
                {mode === "signup" ? t.login.alreadyHaveAccount : t.login.dontHaveAccount}{" "}
                <button type="button"
                  className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? t.login.signIn : t.login.signUp}
                </button>
              </p>
            )}
          </div>

          {/* Subtle branding */}
          <p className="text-center text-slate-700 text-xs mt-10">
            DashMeeting · Meeting Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  );
}
