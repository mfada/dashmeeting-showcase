import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectMeetings } from "@/hooks/useProjectData";
import { useTasksForMeeting } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { MessageSquare, ChevronDown, ChevronRight, ListChecks, Loader2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

interface Props { projectId: string; }

const sourceColors: Record<string, string> = {
  fireflies: "bg-violet-100 text-violet-700 border-violet-200",
  file_upload: "bg-sky-100 text-sky-700 border-sky-200",
  plaud: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function MeetingRow({ meeting, projectId }: { meeting: any; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const { data: tasks, isLoading: tasksLoading } = useTasksForMeeting(expanded ? meeting.id : undefined);
  const qc = useQueryClient();

  // Tasks not yet assigned to this project
  const importable = (tasks ?? []).filter(tk => !tk.project_id);
  const alreadyImported = (tasks ?? []).filter(tk => tk.project_id === projectId);

  const toggleAll = () => {
    if (checked.size === importable.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(importable.map(tk => tk.id)));
    }
  };

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) setChecked(new Set()); // reset selection on open
  };

  const handleImport = async () => {
    if (checked.size === 0) {
      toast.error("Select at least one action item to import.");
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ project_id: projectId })
        .in("id", Array.from(checked));
      if (error) throw error;
      toast.success(`${checked.size} task${checked.size !== 1 ? "s" : ""} imported to project.`);
      setChecked(new Set());
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks", "meeting", meeting.id] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="border shadow-sm overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{meeting.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(parseISO(meeting.date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {alreadyImported.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-green-200 text-green-600">
                {alreadyImported.length} imported
              </Badge>
            )}
            {importable.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-600">
                {importable.length} pending
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] border ${sourceColors[meeting.source] ?? "bg-muted text-muted-foreground border-border"}`}>
              {meeting.source}
            </Badge>
          </div>
        </div>
        {meeting.general_summary && !expanded && (
          <div className="text-xs text-muted-foreground mt-2 line-clamp-1 ml-6 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0">
            <ReactMarkdown>{meeting.general_summary}</ReactMarkdown>
          </div>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t bg-muted/20">
          {/* Summary */}
          {meeting.general_summary && (
            <div className="px-4 py-3 text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 border-b">
              <ReactMarkdown>{meeting.general_summary}</ReactMarkdown>
            </div>
          )}

          {/* Action items */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> Action Items
              </p>
              <Link
                to={`/meetings/${meeting.id}`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
                onClick={e => e.stopPropagation()}
              >
                View full meeting <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {tasksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (tasks ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No action items in this meeting.</p>
            ) : (
              <>
                {/* Already imported tasks */}
                {alreadyImported.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Already in project</p>
                    {alreadyImported.map(tk => (
                      <div key={tk.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-50 dark:bg-green-950/20">
                        <div className="h-3.5 w-3.5 rounded-sm border-2 border-green-400 bg-green-400 flex items-center justify-center shrink-0">
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-xs text-muted-foreground line-through flex-1">{tk.description}</p>
                        {tk.assignee_name && tk.assignee_name !== "Unassigned" && (
                          <span className="text-[10px] text-muted-foreground shrink-0">→ {tk.assignee_name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Importable tasks */}
                {importable.length > 0 && (
                  <div className="space-y-1">
                    {alreadyImported.length > 0 && (
                      <p className="text-[10px] uppercase tracking-wide text-amber-600 font-medium">Not yet imported</p>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        onClick={toggleAll}
                      >
                        {checked.size === importable.length ? "Deselect all" : "Select all"}
                      </button>
                      <span className="text-xs text-muted-foreground">{checked.size} selected</span>
                    </div>
                    <div className="rounded-md border divide-y">
                      {importable.map(tk => (
                        <label
                          key={tk.id}
                          className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={checked.has(tk.id)}
                            onCheckedChange={() => {
                              setChecked(prev => {
                                const next = new Set(prev);
                                next.has(tk.id) ? next.delete(tk.id) : next.add(tk.id);
                                return next;
                              });
                            }}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug">{tk.description}</p>
                            {tk.assignee_name && tk.assignee_name !== "Unassigned" && (
                              <p className="text-xs text-muted-foreground mt-0.5">→ {tk.assignee_name}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              tk.priority === "HIGH" || tk.priority === "CRITICAL"
                                ? "border-red-200 text-red-600"
                                : tk.priority === "MEDIUM"
                                ? "border-amber-200 text-amber-600"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {tk.priority}
                          </Badge>
                        </label>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      className="w-full mt-2"
                      disabled={checked.size === 0 || importing}
                      onClick={handleImport}
                    >
                      {importing
                        ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Importing…</>
                        : <>Import {checked.size > 0 ? `${checked.size} ` : ""}task{checked.size !== 1 ? "s" : ""} to project</>
                      }
                    </Button>
                  </div>
                )}

                {importable.length === 0 && alreadyImported.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center py-1">All action items already imported.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export function ProjectMeetingsTab({ projectId }: Props) {
  const { data: meetings, isLoading } = useProjectMeetings(projectId);
  const { t } = useLanguage();

  if (isLoading) return (
    <div className="space-y-3 mt-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm text-muted-foreground">
        {(meetings ?? []).length} {t.projectDetail.meetingsCount}
        {(meetings ?? []).length > 0 && (
          <span className="ml-1">· Click a meeting to review and import action items</span>
        )}
      </p>
      {(meetings ?? []).length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">{t.projectDetail.noMeetings}</p>
        </div>
      ) : (
        (meetings ?? []).map(m => (
          <MeetingRow key={m.id} meeting={m} projectId={projectId} />
        ))
      )}
    </div>
  );
}
