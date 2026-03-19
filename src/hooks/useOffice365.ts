import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Office365Integration {
  id: string;
  email: string | null;
  display_name: string | null;
  last_synced_at: string | null;
  is_active: boolean;
  token_expires_at: string | null;
}

export function useOffice365Integration() {
  return useQuery({
    queryKey: ["office365-integration"],
    queryFn: async (): Promise<Office365Integration | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_integrations")
        .select("id, email, display_name, last_synced_at, is_active, token_expires_at")
        .eq("user_id", user.id)
        .eq("provider", "office365")
        .eq("is_active", true)
        .maybeSingle();
      return data as Office365Integration | null;
    },
  });
}

export function useDisconnectOffice365() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_integrations")
        .update({ is_active: false, access_token: null, refresh_token: null })
        .eq("user_id", user.id)
        .eq("provider", "office365");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["office365-integration"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
