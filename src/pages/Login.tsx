import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_TIMEOUT_KEY } from "@/hooks/useSessionTimeout";
import rbiLogo from "@/assets/rbi-logo.jpeg";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      setLoading(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Password reset email sent",
          description: "Check your inbox for a link to reset your password.",
        });
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

  const titles: Record<Mode, string> = {
    signin: t.login.signInAccount,
    signup: t.login.createAccount,
    forgot: "Reset your password",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <img src={rbiLogo} alt="RBI Private Lending" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-xl">RBI Private Lending</CardTitle>
          <CardDescription>{titles[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t.login.fullName}</Label>
                <Input id="fullName" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.login.email}</Label>
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t.login.password}</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => { setMode("forgot"); setPassword(""); }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t.login.pleaseWait
                : mode === "forgot"
                  ? "Send reset email"
                  : mode === "signup"
                    ? t.login.signUp
                    : t.login.signIn}
            </Button>
          </form>

          {mode === "forgot" ? (
            <p className="text-center text-sm text-muted-foreground mt-4">
              <button type="button" className="text-primary hover:underline" onClick={() => setMode("signin")}>
                ← Back to sign in
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground mt-4">
              {mode === "signup" ? t.login.alreadyHaveAccount : t.login.dontHaveAccount}{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? t.login.signIn : t.login.signUp}
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
