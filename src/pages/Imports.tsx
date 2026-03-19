import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Upload, Loader2, CheckCircle, XCircle, Clock, Mic, FolderKanban } from "lucide-react";
import { useImports } from "@/hooks/useSupabaseData";
import { useProjects } from "@/hooks/useProjectData";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ImportStatus } from "@/types";

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const sourceBadge: Record<string, string> = {
  fireflies: "bg-violet-100 text-violet-700 border-violet-200",
  file_upload: "bg-sky-100 text-sky-700 border-sky-200",
  plaud: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const sourceLabel: Record<string, string> = {
  fireflies: "Fireflies",
  file_upload: "File Upload",
  plaud: "Plaud",
};

export default function Imports() {
  const { data: imports, isLoading } = useImports();
  const { data: projects } = useProjects();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plaudInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPlaud, setUploadingPlaud] = useState(false);
  // Track which import row is currently saving a project change
  const [savingProject, setSavingProject] = useState<string | null>(null);
  // Local overrides: importId -> projectId (for optimistic UI)
  const [projectOverrides, setProjectOverrides] = useState<Record<string, string>>({});

  const statusConfig: Record<ImportStatus, { icon: typeof CheckCircle; className: string; label: string }> = {
    completed: { icon: CheckCircle, className: "text-success", label: t.imports.statusCompleted },
    processing: { icon: Loader2, className: "text-primary animate-spin", label: t.imports.statusProcessing },
    pending: { icon: Clock, className: "text-warning", label: t.imports.statusPending },
    failed: { icon: XCircle, className: "text-destructive", label: t.imports.statusFailed },
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["imports"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["kpis"] });
  };

  const handleSync = async () => {
    toast.info(
      "Fireflies sync is not available in this demo environment. In a live deployment, this connects directly to your Fireflies.ai account to automatically import meeting transcripts and extract action items.",
      { duration: 6000 }
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeFileName = sanitizeFileName(file.name);
      const filePath = `${crypto.randomUUID()}/${safeFileName}`;
      const { error: uploadErr } = await supabase.storage.from("meeting-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data, error } = await supabase.functions.invoke("parse-upload", {
        body: { file_path: filePath, file_name: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const projectName = data.assigned_project_name;
      toast.success(projectName
        ? `Meeting imported and assigned to "${projectName}"`
        : "Meeting imported — assign a project in the table below"
      );
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePlaudUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPlaud(true);
    try {
      const safeFileName = sanitizeFileName(file.name);
      const filePath = `${crypto.randomUUID()}/${safeFileName}`;
      const { error: uploadErr } = await supabase.storage.from("meeting-uploads").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data, error } = await supabase.functions.invoke("parse-upload", {
        body: { file_path: filePath, file_name: file.name, source_hint: "plaud" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const projectName = data.assigned_project_name;
      toast.success(projectName
        ? `Plaud note imported and assigned to "${projectName}"`
        : `Plaud note imported with ${data.tasks_created} action item${data.tasks_created !== 1 ? "s" : ""} — assign a project below`
      );
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || "Plaud import failed");
    } finally {
      setUploadingPlaud(false);
      if (plaudInputRef.current) plaudInputRef.current.value = "";
    }
  };

  const handleProjectChange = async (imp: any, newProjectId: string) => {
    setSavingProject(imp.id);
    // Optimistic update
    setProjectOverrides(prev => ({ ...prev, [imp.id]: newProjectId }));
    try {
      // Find the meeting tied to this import
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id")
        .eq("import_id", imp.id);

      if (meetings && meetings.length > 0) {
        const meetingId = meetings[0].id;
        // Update meeting project
        await supabase.from("meetings").update({ project_id: newProjectId }).eq("id", meetingId);
        // Update tasks that are still unassigned (don't override manually set ones)
        await supabase.from("tasks")
          .update({ project_id: newProjectId })
          .eq("meeting_id", meetingId)
          .is("project_id", null);
      }
      const proj = (projects ?? []).find(p => p.id === newProjectId);
      toast.success(`Assigned to "${proj?.name ?? "project"}"`);
      invalidateAll();
    } catch (err: any) {
      // Revert optimistic update on error
      setProjectOverrides(prev => { const n = { ...prev }; delete n[imp.id]; return n; });
      toast.error(err.message || "Failed to update project");
    } finally {
      setSavingProject(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.imports.title}</h1>
        <p className="text-sm text-muted-foreground">{t.imports.subtitle}</p>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.docx,.doc,.rtf,.csv,.json,.xml,.html,.htm,.pptx,.xlsx" className="hidden" onChange={handleUpload} />
      <input ref={plaudInputRef} type="file" accept=".txt,.md,.docx" className="hidden" onChange={handlePlaudUpload} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fireflies */}
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-3">
              <Zap className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="font-semibold">{t.imports.syncFireflies}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.imports.syncDescription}</p>
            <Button className="mt-4" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              {syncing ? t.imports.syncing : t.imports.syncNow}
            </Button>
          </CardContent>
        </Card>

        {/* Plaud */}
        <Card className="border-dashed border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <Mic className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold">{t.imports.plaudTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.imports.plaudDescription}</p>
            <Button
              variant="outline"
              className="mt-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
              size="sm"
              onClick={() => plaudInputRef.current?.click()}
              disabled={uploadingPlaud}
            >
              {uploadingPlaud ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploadingPlaud ? t.imports.parsing : t.imports.plaudUpload}
            </Button>
            <a href="https://web.plaud.ai" target="_blank" rel="noopener noreferrer"
              className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
              {t.imports.plaudHowTo} ↗
            </a>
          </CardContent>
        </Card>

        {/* Generic file upload */}
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-3">
              <Upload className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="font-semibold">{t.imports.uploadFile}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.imports.uploadDescription}</p>
            <Button variant="outline" className="mt-4" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploading ? t.imports.parsing : t.imports.chooseFile}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t.imports.importHistory}
            <span className="text-xs font-normal text-muted-foreground">— assign or change project directly in this table</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.imports.source}</TableHead>
                  <TableHead>{t.imports.file}</TableHead>
                  <TableHead>{t.tasks.status}</TableHead>
                  <TableHead>{t.imports.meetingsCol}</TableHead>
                  <TableHead>{t.imports.tasksCol}</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <FolderKanban className="h-3.5 w-3.5" /> Project
                    </span>
                  </TableHead>
                  <TableHead>{t.imports.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(imports ?? []).map((imp) => {
                  const cfg = statusConfig[imp.status];
                  const StatusIcon = cfg.icon;
                  const badgeCls = sourceBadge[imp.source_type] ?? "bg-muted text-muted-foreground border-border";
                  const label = sourceLabel[imp.source_type] ?? imp.source_type;
                  const isSaving = savingProject === imp.id;

                  return (
                    <TableRow key={imp.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] border ${badgeCls}`}>{label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{imp.file_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`h-3.5 w-3.5 ${cfg.className}`} />
                          <span className="text-sm">{cfg.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{imp.meetings_created}</TableCell>
                      <TableCell className="text-sm">{imp.tasks_created}</TableCell>
                      <TableCell>
                        {imp.status === "completed" ? (
                          <div className="flex items-center gap-1.5">
                            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                            <Select
                              value={projectOverrides[imp.id] ?? (imp as any).project_id ?? ""}
                              onValueChange={(val) => handleProjectChange(imp, val)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Assign project…" />
                              </SelectTrigger>
                              <SelectContent>
                                {(projects ?? []).map(p => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(parseISO(imp.created_at), "MMM d, h:mm a")}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(imports ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">{t.imports.noImports}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

