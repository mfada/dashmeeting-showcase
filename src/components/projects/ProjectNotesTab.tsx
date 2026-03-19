import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { projectId: string; }

export function ProjectNotesTab({ projectId }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["project-note", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Only set innerHTML once when note first loads
  useEffect(() => {
    if (note?.content != null && editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = note.content;
      initializedRef.current = true;
    }
  }, [note]);

  // Reset when projectId changes
  useEffect(() => {
    initializedRef.current = false;
    setDirty(false);
  }, [projectId]);

  const upsertNote = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not authenticated");
      if (note?.id) {
        const { error } = await supabase.from("notes").update({ content, updated_at: new Date().toISOString() }).eq("id", note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notes").insert({
          entity_type: "project",
          entity_id: projectId,
          content,
          author_id: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Don't invalidate to avoid re-rendering the contentEditable
      setDirty(false);
      toast({ title: t.projectSettings.projectUpdated });
    },
  });

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
  }, []);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-3 mt-4">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-muted/30">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <select
          className="h-7 text-xs border rounded px-1 bg-background"
          defaultValue="3"
          onChange={e => exec("fontSize", e.target.value)}
        >
          <option value="1">XS</option>
          <option value="2">S</option>
          <option value="3">M</option>
          <option value="4">L</option>
          <option value="5">XL</option>
        </select>
        <input
          type="color"
          className="h-6 w-6 rounded cursor-pointer border-0 p-0"
          defaultValue="#000000"
          onChange={e => exec("foreColor", e.target.value)}
          title={t.projectSettings.color}
        />
        <div className="flex-1" />
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-7 gap-1 text-xs"
          disabled={upsertNote.isPending || !dirty}
          onClick={() => {
            if (editorRef.current) upsertNote.mutate(editorRef.current.innerHTML);
          }}
        >
          <Save className="h-3 w-3" /> {t.projectSettings.save}
        </Button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[300px] rounded-lg border bg-card p-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm dark:prose-invert max-w-none"
        onInput={() => setDirty(true)}
      />
    </div>
  );
}
