import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
    // Fetch phone separately since it may not be in the auth context yet
    if (user?.id) {
      supabase.from("profiles").select("phone").eq("id", user.id).single().then(({ data }) => {
        setPhone((data as any)?.phone ?? "");
      });
    }
  }, [profile, user]);

  const initials = (fullName || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      // Add cache buster
      const url = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      toast({ title: t.profile?.avatarUpdated ?? "Profile picture updated" });
    } catch (err) {
      toast({ title: t.common.error, description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      } as any).eq("id", user.id);
      if (error) throw error;
      toast({ title: t.profile?.profileUpdated ?? "Profile updated" });
    } catch (err) {
      toast({ title: t.common.error, description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">{t.profile?.title ?? "Profile Settings"}</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.profile?.profilePicture ?? "Profile Picture"}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-medium">{initials}</AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t.profile?.uploadHint ?? "Click the camera icon to upload a new photo"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.profile?.personalInfo ?? "Personal Information"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">{t.users?.fullName ?? "Full Name"}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">{t.profile?.phone ?? "Phone"}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <Label className="text-xs">{t.users?.email ?? "Email"}</Label>
            <Input value={user?.email ?? ""} disabled className="h-9 opacity-60" />
            <p className="text-[10px] text-muted-foreground mt-1">{t.profile?.emailReadonly ?? "Email cannot be changed"}</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {t.profile?.save ?? "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
