import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Users, ListChecks, FileText, ChevronDown, Loader2,
  LinkIcon, AlertTriangle, FolderOpen, Trash2, Pencil, Plus, Check, X,
  FolderKanban, CheckCircle2,
} from "lucide-react";
import {
  useMeeting, useTasksForMeeting, useProfiles, useUpdateParticipantUser,
  useAssignMeetingProject, useDeleteTasks, useUpdateTaskDetails,
} from "@/hooks/useSupabaseData";
import TaskAssigneeSelect from "@/components/tasks/TaskAssigneeSelect";
import { useProjects } from "@/hooks/useProjectData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function MeetingDetail() {
  const { id } = useParams();
  const { data: meeting, isLoading } = useMeeting(id);
  const { data: tasks } = useTasksForMeeting(id);
  const { data: profiles } = useProfiles();
  const { data: projects } = useProjects();
  const { isAdmin, user, profile } = useAuth();
  const { t } = useLanguage();
  const updateParticipantUser = useUpdateParticipantUser();
  const assignProject = useAssignMeetingProject();
  const deleteTasks = useDeleteTasks();
  const updateTaskDetails = useUpdateTaskDetails();
  const qc = useQueryClient();

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");

  // Task selection state — always visible to admin
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Confirmation: admin picks project with 0 tasks selected
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [confirmNoTasksOpen, setConfirmNoTasksOpen] = useState(false);

  const looksLikeName = (desc: string) => {
    const clean = desc.replace(/\*\*/g, "").trim();
    return /^[A-Z][a-zà-ú]+(\s[A-Z][a-zà-ú]+){0,2}$/.test(clean) && clean.split(/\s+/).length <= 3;
  };
  const nameOnlyTasks = (tasks ?? []).filter((tk) => looksLikeName(tk.description));

  const handleCleanupNameTasks = () => {
    if (nameOnlyTasks.length === 0) { toast({ title: t.meetingDetail.noNameTasks }); return; }
    deleteTasks.mutate(nameOnlyTasks.map((tk) => tk.id), {
      onSuccess: () => toast({ title: t.meetingDetail.cleanupSuccess }),
      onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
    });
  };

  const handleSaveTaskDesc = (taskId: string) => {
    updateTaskDetails.mutate(
      { taskId, description: editDesc },
      {
        onSuccess: () => { setEditingTaskId(null); toast({ title: t.projectTasksTab.taskUpdated }); },
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleAddTask = async () => {
    if (!newTaskDesc.trim() || !meeting) return;
    try {
      const { error } = await supabase.from("tasks").insert({
        meeting_id: meeting.id,
        project_id: null,
        description: newTaskDesc.trim(),
        assignee_name: profile?.full_name ?? "Unassigned",
        assignee_user_id: user?.id,
      });
      if (error) throw error;
      toast({ title: t.projectDetail.taskCreated });
      setNewTaskDesc(""); setAddingTask(false);
      qc.invalidateQueries({ queryKey: ["tasks", "meeting", id] });
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTasks.mutate([taskId], {
      onSuccess: () => toast({ title: t.meetingDetail.cleanupSuccess }),
    });
  };

  // Called when admin picks a project from the dropdown
  const handleAssignProject = useCallback((projectId: string) => {
    // If no tasks selected → warn before proceeding
    const unimported = (tasks ?? []).filter(tk => !tk.project_id);
    if (selectedTaskIds.size === 0 && unimported.length > 0) {
      setPendingProjectId(projectId);
      setConfirmNoTasksOpen(true);
      return;
    }
    doAssignAndImport(projectId);
  }, [meeting, tasks, selectedTaskIds]);

  // Assign project to meeting AND import selected tasks in one go
  const doAssignAndImport = async (projectId: string) => {
    if (!meeting) return;
    setAssigning(true);
    try {
      // 1. Assign project to the meeting
      await new Promise<void>((resolve, reject) => {
        assignProject.mutate(
          { meetingId: meeting.id, projectId },
          { onSuccess: () => resolve(), onError: (e) => reject(e) }
        );
      });

      // 2. Import selected tasks
      const toImport = Array.from(selectedTaskIds);
      if (toImport.length > 0) {
        const { error } = await supabase.from("tasks")
          .update({ project_id: projectId })
          .in("id", toImport);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["tasks", "meeting", id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["projects"] });

      if (toImport.length > 0) {
        toast({ title: `Project assigned · ${toImport.length} task(s) added to project` });
      } else {
        toast({ title: t.meetings.projectAssigned });
      }
      setSelectedTaskIds(new Set());
    } catch (err: any) {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const toggleAll = () => {
    const unimported = (tasks ?? []).filter(tk => !tk.project_id).map(tk => tk.id);
    setSelectedTaskIds(prev =>
      prev.size === unimported.length && unimported.every(id => prev.has(id))
        ? new Set()
        : new Set(unimported)
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t.meetingDetail.meetingNotFound}</p>
        <Link to="/meetings" className="text-primary text-sm mt-2 hover:underline">{t.meetingDetail.backToMeetings}</Link>
      </div>
    );
  }

  const statusColor: Record<string, string> = { OPEN: "bg-warning/10 text-warning", IN_PROGRESS: "bg-primary/10 text-primary", COMPLETED: "bg-success/10 text-success" };
  const assignedProject = (projects ?? []).find((p) => p.id === meeting.project_id);

  const allTasks = tasks ?? [];
  const importedTasks = allTasks.filter(tk => !!tk.project_id);
  const availableTasks = allTasks.filter(tk => !tk.project_id);
  const unimportedCount = availableTasks.length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/meetings"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-bold">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">{format(parseISO(meeting.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Badge variant="outline">{meeting.source}</Badge>
        {meeting.tags?.map((tg) => <Badge key={tg.id} variant="secondary">{tg.name}</Badge>)}
        <div className="flex items-center gap-2 ml-auto">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {assignedProject ? (
            <Badge variant="secondary">{assignedProject.name}</Badge>
          ) : (
            isAdmin ? (
              <Select onValueChange={handleAssignProject} disabled={assigning}>
                <SelectTrigger className="h-7 w-auto text-xs border-warning/40 text-warning gap-1 px-2">
                  {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                  <SelectValue placeholder={t.meetings.unassigned} />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-warning border-warning/30">{t.meetings.unassigned}</Badge>
            )
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t.meetingDetail.summary}</CardTitle></CardHeader>
        <CardContent><div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{meeting.general_summary ?? ""}</ReactMarkdown></div></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> {t.meetingDetail.participants}
            {isAdmin && <span className="text-xs font-normal text-muted-foreground ml-2">{t.meetingDetail.linkParticipantsHint}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="space-y-2">
              {meeting.participants?.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <Badge variant="secondary" className="shrink-0">{p.name}</Badge>
                  <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Select value={(p as any).user_id ?? "none"} onValueChange={(val) => updateParticipantUser.mutate({ participantId: p.id, userId: val === "none" ? null : val }, { onSuccess: () => toast({ title: t.meetingDetail.participantLinked }) })}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder={t.meetingDetail.unlinked} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs text-muted-foreground">{t.meetingDetail.unlinked}</SelectItem>
                      {(profiles ?? []).map((pr: any) => (
                        <SelectItem key={pr.id} value={pr.id} className="text-xs">{pr.full_name ?? pr.email} ({pr.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {meeting.participants?.map((p) => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      {meeting.topics && meeting.topics.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> {t.meetingDetail.topicsAndNotes}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {meeting.topics.map((topic) => (
              <div key={topic.id} className="border-l-2 border-primary/30 pl-4">
                <h4 className="text-sm font-semibold">{topic.title}</h4>
                <ul className="mt-1.5 space-y-1">
                  {topic.notes.map((note, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1.5 block h-1 w-1 rounded-full bg-primary shrink-0" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Action Items ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">{t.meetingDetail.actionItems} ({allTasks.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingTask(true)}>
                  <Plus className="h-3 w-3" /> {t.projectDetail.addTask}
                </Button>
              )}
              {isAdmin && nameOnlyTasks.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />
                      {t.meetingDetail.cleanupNameTasks} ({nameOnlyTasks.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.meetingDetail.cleanupConfirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.meetingDetail.cleanupConfirmDesc}
                        <ul className="mt-2 space-y-1 text-sm">
                          {nameOnlyTasks.map((tk) => <li key={tk.id} className="text-destructive">• {tk.description.replace(/\*\*/g, "")}</li>)}
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.meetingDetail.cleanupConfirmCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCleanupNameTasks} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {t.meetingDetail.cleanupConfirmAction}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Select-all + hint bar — shown to admin when there are unimported tasks and NO project yet */}
          {isAdmin && !meeting.project_id && unimportedCount > 0 && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-primary/5 rounded-lg border border-primary/15">
              <Checkbox
                checked={selectedTaskIds.size === unimportedCount && unimportedCount > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground flex-1">
                <span className="font-medium text-foreground">{selectedTaskIds.size}</span> of{" "}
                <span className="font-medium">{unimportedCount}</span> tasks selected ·{" "}
                <span className="text-primary font-medium">Select tasks, then assign a project above</span>
              </span>
            </div>
          )}

          {/* When project already assigned and unimported tasks still exist */}
          {isAdmin && meeting.project_id && unimportedCount > 0 && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Checkbox
                checked={selectedTaskIds.size === unimportedCount && unimportedCount > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground flex-1">
                <span className="font-medium text-foreground">{selectedTaskIds.size}</span> of{" "}
                <span className="font-medium">{unimportedCount}</span> tasks selected
              </span>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  if (selectedTaskIds.size === 0) { setPendingProjectId(meeting.project_id!); setConfirmNoTasksOpen(true); return; }
                  setAssigning(true);
                  supabase.from("tasks").update({ project_id: meeting.project_id }).in("id", Array.from(selectedTaskIds))
                    .then(({ error }) => {
                      if (error) { toast({ title: t.common.error, description: error.message, variant: "destructive" }); }
                      else {
                        qc.invalidateQueries({ queryKey: ["tasks", "meeting", id] });
                        qc.invalidateQueries({ queryKey: ["tasks"] });
                        qc.invalidateQueries({ queryKey: ["kpis"] });
                        qc.invalidateQueries({ queryKey: ["projects"] });
                        toast({ title: `${selectedTaskIds.size} task(s) added to project` });
                        setSelectedTaskIds(new Set());
                      }
                    })
                    .finally(() => setAssigning(false));
                }}
                disabled={assigning}
              >
                {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderKanban className="h-3 w-3" />}
                Add {selectedTaskIds.size > 0 ? `${selectedTaskIds.size}` : ""} to project
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {addingTask && (
            <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
              <Input
                value={newTaskDesc}
                onChange={e => setNewTaskDesc(e.target.value)}
                placeholder={t.projectDetail.taskName}
                className="flex-1 h-8 text-sm"
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
              />
              <Button size="icon" className="h-8 w-8" onClick={handleAddTask}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setAddingTask(false); setNewTaskDesc(""); }}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}

          {allTasks.length === 0 && !addingTask && (
            <p className="text-sm text-muted-foreground text-center py-6">No action items for this meeting.</p>
          )}

          {/* Available / unimported tasks */}
          {availableTasks.map((tk) => (
            <div
              key={tk.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                isAdmin ? "hover:bg-muted/30 cursor-pointer" : ""
              } ${selectedTaskIds.has(tk.id) ? "border-primary/40 bg-primary/5" : ""}`}
              onClick={() => isAdmin ? toggleTask(tk.id) : undefined}
            >
              {isAdmin && (
                <div className="mt-0.5" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedTaskIds.has(tk.id)}
                    onCheckedChange={() => toggleTask(tk.id)}
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {editingTaskId === tk.id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="flex-1 h-8 text-sm" onKeyDown={e => e.key === "Enter" && handleSaveTaskDesc(tk.id)} />
                    <Button size="icon" className="h-8 w-8" onClick={() => handleSaveTaskDesc(tk.id)}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTaskId(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{tk.description}</ReactMarkdown></div>
                )}
                <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
                  <TaskAssigneeSelect task={tk} />
                  {tk.due_date && <span className="text-xs text-muted-foreground">{t.dashboard.due} {format(parseISO(tk.due_date), "MMM d")}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <Badge className={`text-[10px] ${statusColor[tk.status]}`} variant="secondary">{t.statuses[tk.status as keyof typeof t.statuses]}</Badge>
                {isAdmin && editingTaskId !== tk.id && (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingTaskId(tk.id); setEditDesc(tk.description); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteTask(tk.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Already-imported tasks — read-only */}
          {importedTasks.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Already in project ({importedTasks.length})
              </p>
              {importedTasks.map((tk) => (
                <div key={tk.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-3 opacity-50 mb-2 bg-muted/20 select-none">
                  {isAdmin && <Checkbox checked={false} disabled className="mt-0.5 opacity-40" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-muted-foreground line-through">{tk.description.replace(/\*\*/g, "")}</div>
                  </div>
                  <Badge className="text-[10px] bg-success/10 text-success border-success/20 shrink-0" variant="outline">
                    <FolderKanban className="h-2.5 w-2.5 mr-1" /> In project
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> {t.meetingDetail.fullTranscript}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${transcriptOpen ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {meeting.raw_transcript || t.meetingDetail.transcriptNotAvailable}
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Confirm: no tasks selected when assigning project */}
      <AlertDialog open={confirmNoTasksOpen} onOpenChange={setConfirmNoTasksOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> No tasks selected
            </AlertDialogTitle>
            <AlertDialogDescription>
              You haven't selected any tasks. If you proceed, the project will be assigned to this meeting but{" "}
              <strong>no tasks will be added to the project</strong> — all tasks will remain in the meeting history only
              and won't count in dashboards or statistics.
              <br /><br />
              You can come back to this meeting at any time to add tasks to the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingProjectId(null)}>Go back and select tasks</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pid = pendingProjectId;
                setConfirmNoTasksOpen(false);
                setPendingProjectId(null);
                if (pid) doAssignAndImport(pid);
              }}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Assign project without tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
