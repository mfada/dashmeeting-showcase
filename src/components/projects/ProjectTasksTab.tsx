import { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Send, Calendar as CalIcon, Download, FileText, LayoutGrid, List, Mail, UserCheck, CheckCircle2, ChevronDown, ChevronUp, Check, X, Filter } from "lucide-react";
import { useProjectTasks, useCreateProjectTask } from "@/hooks/useProjectData";
import { useUpdateTaskStatus, useUpdateTaskPriority, useUpdateTaskDueDate, useUpdateTaskDetails, useTaskDependencies, useDeleteTasks, useProfiles } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { Task, TaskStatus, TaskPriority, TaskSource } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import TaskAssigneeSelect from "@/components/tasks/TaskAssigneeSelect";
import KanbanColumn from "@/components/tasks/KanbanColumn";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<TaskStatus, { cls: string }> = {
  OPEN: { cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { cls: "bg-emerald-50 text-emerald-700" },
  BLOCKED: { cls: "bg-red-50 text-red-600" },
  COMPLETED: { cls: "bg-green-100 text-green-700" },
};

const priorityStyles: Record<TaskPriority, { cls: string }> = {
  LOW: { cls: "border-sky-200 bg-sky-50 text-sky-600" },
  MEDIUM: { cls: "border-amber-300 bg-amber-50 text-amber-700" },
  HIGH: { cls: "border-orange-300 bg-orange-50 text-orange-600" },
  CRITICAL: { cls: "border-red-300 bg-red-50 text-red-600" },
};

const sourceStyles: Record<string, string> = {
  manual: "bg-muted text-muted-foreground border-border",
  fireflies: "bg-violet-50 text-violet-700 border-violet-200",
  plaud: "bg-purple-50 text-purple-700 border-purple-200",
  file_upload: "bg-orange-50 text-orange-600 border-orange-200",
};

const sourceLabels: Record<string, string> = {
  manual: "Manual",
  fireflies: "Fireflies",
  plaud: "Plaud",
  file_upload: "Upload",
};

const AVAILABLE_TAGS = [
  { label: "URGENT", activeCls: "bg-red-100 text-red-600 border-red-200" },
  { label: "DESIGN", activeCls: "bg-muted text-foreground border-border" },
  { label: "REVIEW", activeCls: "bg-orange-100 text-orange-600 border-orange-200" },
  { label: "CLIENT", activeCls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "INTERNAL", activeCls: "bg-muted text-foreground border-border" },
  { label: "MARKETING", activeCls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "DEVELOPMENT", activeCls: "bg-sky-100 text-sky-700 border-sky-200" },
  { label: "BUG", activeCls: "bg-red-100 text-red-600 border-red-200" },
];

interface Props { projectId: string; canEdit?: boolean; }

const EMPTY_INLINE = {
  description: "",
  assignee_user_id: "",
  assignee_name: "",
  due_date: "",
  priority: "MEDIUM" as TaskPriority,
  status: "OPEN" as TaskStatus,
};

export function ProjectTasksTab({ projectId, canEdit = false }: Props) {
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const { data: dependencies = [] } = useTaskDependencies();
  const { data: profiles = [] } = useProfiles();
  const createTask = useCreateProjectTask();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const updateDueDate = useUpdateTaskDueDate();
  const updateDetails = useUpdateTaskDetails();
  const deleteTasks = useDeleteTasks();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [editTask, setEditTask] = useState<any>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Inline add row
  const [inlineActive, setInlineActive] = useState(false);
  const [inlineForm, setInlineForm] = useState(EMPTY_INLINE);
  const inlineDescRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inlineActive) {
      setTimeout(() => inlineDescRef.current?.focus(), 50);
    }
  }, [inlineActive]);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Bulk assign state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState<string>("");

  // Bulk status state
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<TaskStatus | "">("");
  const [showCompleted, setShowCompleted] = useState(false);

  const allTasks = tasks ?? [];
  const activeTasks = allTasks.filter(t => t.status !== "COMPLETED");
  const completedTasks = allTasks.filter(t => t.status === "COMPLETED");
  const blockedTaskIds = new Set<string>();

  const filteredActive = sourceFilter === "all"
    ? activeTasks
    : activeTasks.filter(t => (t.source ?? "manual") === sourceFilter);

  // ── CSV Export ───────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Description", "Status", "Priority", "Assignee", "Due Date", "Source"];
    const rows = allTasks.map(t => [
      `"${(t.description ?? "").replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      `"${(t.assignee_name ?? "").replace(/"/g, '""')}"`,
      t.due_date ?? "",
      t.source ?? "manual",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ───────────────────────────────────────────────────
  const exportPDF = () => {
    const rows = allTasks.map(t => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;max-width:300px">${t.description ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${t.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${t.priority}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${t.assignee_name ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${t.due_date ? t.due_date.slice(0, 10) : "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${t.source ?? "manual"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Tasks Export</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h2{color:#1E3A5F;margin-bottom:4px}p{color:#666;font-size:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#1E3A5F;color:#fff;padding:10px 12px;text-align:left}
      tr:hover{background:#f9f9f9}
      @media print{button{display:none}}</style></head>
      <body>
        <h2>RBI Private Lending — Task Report</h2>
        <p>Exported ${new Date().toLocaleDateString()} · ${allTasks.length} tasks</p>
        <table><thead><tr>
          <th>Description</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th><th>Source</th>
        </tr></thead><tbody>${rows}</tbody></table>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Inline add row ───────────────────────────────────────────────
  const handleInlineOpen = () => {
    setInlineActive(true);
    setInlineForm(EMPTY_INLINE);
  };

  const handleInlineSave = async () => {
    if (!inlineForm.description.trim() && !inlineForm.assignee_user_id && !inlineForm.due_date) {
      toast({ title: "Nothing entered", description: "Enter at least a task description.", variant: "destructive" });
      return;
    }
    try {
      await createTask.mutateAsync({
        projectId,
        description: inlineForm.description,
        assignee_name: inlineForm.assignee_name,
        assignee_user_id: inlineForm.assignee_user_id || undefined,
        due_date: inlineForm.due_date || undefined,
        priority: inlineForm.priority,
        status: inlineForm.status,
        source: "manual",
      });
      toast({ title: t.projectDetail.taskCreated });
      setInlineActive(false);
      setInlineForm(EMPTY_INLINE);
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  const handleInlineCancel = () => {
    setInlineActive(false);
    setInlineForm(EMPTY_INLINE);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleInlineSave(); }
    if (e.key === "Escape") { e.preventDefault(); handleInlineCancel(); }
  };

  const handleStatusChange = async (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus) => {
    try {
      await updateStatus.mutateAsync({
        taskId, oldStatus, newStatus,
        changedBy: user?.id ?? "", changedByName: profile?.full_name ?? "Unknown",
      });
    } catch {}
  };

  // ── Single task delete ───────────────────────────────────────────
  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTasks.mutateAsync([deleteTarget]);
      toast({ title: "Task deleted" });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Bulk delete ──────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    try {
      await deleteTasks.mutateAsync(Array.from(selectedIds));
      toast({ title: `${selectedIds.size} task(s) deleted` });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  // ── Bulk status ──────────────────────────────────────────────────
  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(taskId => {
          const task = allTasks.find(t => t.id === taskId);
          if (!task || task.status === bulkStatusValue) return Promise.resolve();
          return updateStatus.mutateAsync({
            taskId,
            oldStatus: task.status,
            newStatus: bulkStatusValue,
            changedBy: user?.id ?? "",
            changedByName: profile?.full_name ?? "Unknown",
          });
        })
      );
      toast({ title: `${selectedIds.size} task(s) updated to ${bulkStatusValue}` });
      setSelectedIds(new Set());
      setBulkStatusOpen(false);
      setBulkStatusValue("");
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  // ── Bulk assign ──────────────────────────────────────────────────
  const handleBulkAssign = async () => {
    if (!bulkAssignUserId || selectedIds.size === 0) return;
    const selectedProfile = profiles.find((p: any) => p.id === bulkAssignUserId);
    if (!selectedProfile) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(taskId =>
          updateDetails.mutateAsync({
            taskId,
            assignee_name: selectedProfile.full_name ?? selectedProfile.email ?? "Unknown",
            assignee_user_id: selectedProfile.id,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      toast({ title: `${selectedIds.size} task(s) assigned to ${selectedProfile.full_name ?? selectedProfile.email}` });
      setSelectedIds(new Set());
      setBulkAssignOpen(false);
      setBulkAssignUserId("");
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  // ── Bulk email ───────────────────────────────────────────────────
  const handleBulkEmail = async () => {
    if (selectedIds.size === 0) return;
    try {
      setSendingEmail(true);
      const { error } = await supabase.functions.invoke("send-task-notification", {
        body: { taskIds: Array.from(selectedIds), type: "summary" },
      });
      if (error) throw error;
      toast({ title: t.projectTasksTab.summaryEmailSent });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEmail = async (task: Task) => {
    if (!task.assignee_user_id) {
      toast({ title: t.common.error, description: t.projectTasksTab.noAssigneeEmail, variant: "destructive" });
      return;
    }
    try {
      setSendingEmail(true);
      const { error } = await supabase.functions.invoke("send-task-notification", {
        body: { taskIds: [task.id], type: "task_detail" },
      });
      if (error) throw error;
      toast({ title: t.projectTasksTab.emailSent });
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allTasks.map(t => t.id)));
    }
  };

  if (isLoading) return <div className="pt-6"><Skeleton className="h-48 w-full rounded-xl" /></div>;

  return (
    <div className="space-y-4 pt-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal border-border" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal border-border" onClick={exportPDF}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
          <div className="flex items-center border rounded-lg overflow-hidden ml-2">
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none px-2" onClick={() => setView("list")}>
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none px-2" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Source filter */}
          {view === "list" && (
            <div className="flex items-center gap-1 ml-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-8 text-xs border-border w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="fireflies">Fireflies</SelectItem>
                  <SelectItem value="plaud">Plaud</SelectItem>
                  <SelectItem value="file_upload">Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {canEdit && view === "list" && (
            <>
              <Checkbox
                className="ml-3 h-4 w-4"
                checked={allTasks.length > 0 && selectedIds.size === allTasks.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">{t.projectTasksTab.selectAll}</span>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 ml-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected</span>

                  {/* Bulk Email */}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleBulkEmail} disabled={sendingEmail}>
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Button>

                  {/* Bulk Status */}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setBulkStatusOpen(true)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Status
                  </Button>

                  {/* Bulk Assign */}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setBulkAssignOpen(true)}>
                    <UserCheck className="h-3.5 w-3.5" /> Assign
                  </Button>

                  {/* Bulk Delete */}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:border-destructive" onClick={() => setBulkDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg font-medium"
            onClick={handleInlineOpen}
            disabled={inlineActive}
          >
            <Plus className="h-4 w-4" /> {t.projectDetail.addTask}
          </Button>
        )}
      </div>

      {/* Kanban View */}
      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={allTasks.filter(t => t.status === status)}
              allTasks={allTasks}
              dependencies={dependencies}
              blockedTaskIds={blockedTaskIds}
              onStatusChange={handleStatusChange}
              onDrop={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <>
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tasks.task}</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">{t.tasks.status}</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">{t.projectTasksTab.delivery}</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">{t.tasks.assignee}</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Source</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Inline add row */}
              {inlineActive && (
                <TableRow className="border-b border-accent/40 bg-accent/5 h-[60px]">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={inlineForm.priority}
                        onValueChange={v => setInlineForm(f => ({ ...f, priority: v as TaskPriority }))}
                      >
                        <SelectTrigger className="h-6 w-auto border-0 px-1.5 text-[9px] font-bold uppercase tracking-wide shadow-none bg-transparent focus:ring-0 focus:ring-offset-0">
                          <SelectValue>
                            <span className={`inline-flex px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wide border ${priorityStyles[inlineForm.priority].cls}`}>
                              {t.priorities[inlineForm.priority]}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TaskPriority[]).map(p => (
                            <SelectItem key={p} value={p}>{t.priorities[p]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        ref={inlineDescRef}
                        value={inlineForm.description}
                        onChange={e => setInlineForm(f => ({ ...f, description: e.target.value }))}
                        onKeyDown={handleInlineKeyDown}
                        placeholder="Task description…"
                        className="h-7 text-[13px] border-accent/60 focus-visible:ring-accent/20 bg-white min-w-[180px]"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inlineForm.status}
                      onValueChange={v => setInlineForm(f => ({ ...f, status: v as TaskStatus }))}
                    >
                      <SelectTrigger className={`h-[26px] w-auto border-0 px-2.5 text-[11px] font-medium rounded-full shadow-none ${statusStyles[inlineForm.status].cls}`}>
                        <SelectValue>{t.statuses[inlineForm.status]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={inlineForm.due_date}
                      onChange={e => setInlineForm(f => ({ ...f, due_date: e.target.value }))}
                      onKeyDown={handleInlineKeyDown}
                      className="h-7 text-[12px] border-accent/60 focus-visible:ring-accent/20 bg-white w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inlineForm.assignee_user_id || "__none__"}
                      onValueChange={v => {
                        if (v === "__none__") {
                          setInlineForm(f => ({ ...f, assignee_user_id: "", assignee_name: "" }));
                        } else {
                          const p = profiles.find((pr: any) => pr.id === v);
                          setInlineForm(f => ({
                            ...f,
                            assignee_user_id: v,
                            assignee_name: p?.full_name ?? p?.email ?? "",
                          }));
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-[12px] border-accent/60 focus-visible:ring-accent/20 bg-white w-36">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {profiles.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name ?? p.email ?? p.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-1.5 py-[1px] rounded text-[9px] font-semibold border bg-muted text-muted-foreground border-border">
                      Manual
                    </span>
                  </TableCell>
                  <TableCell className="pr-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                        onClick={handleInlineSave}
                        disabled={createTask.isPending}
                        title="Save (Enter)"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={handleInlineCancel}
                        title="Cancel (Escape)"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {allTasks.length === 0 && !inlineActive ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground text-sm">
                    {t.tasks.noTasks}
                  </TableCell>
                </TableRow>
              ) : (
                filteredActive.map(task => {
                  const ss = statusStyles[task.status];
                  const ps = priorityStyles[task.priority];
                  const src = task.source ?? "manual";
                  return (
                    <TableRow key={task.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors group h-[60px]">
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {canEdit && (
                            <Checkbox
                              className="h-4 w-4 shrink-0"
                              checked={selectedIds.has(task.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                checked ? next.add(task.id) : next.delete(task.id);
                                setSelectedIds(next);
                              }}
                            />
                          )}
                          <span className={`inline-flex px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wide border ${ps.cls}`}>
                            {t.priorities[task.priority]}
                          </span>
                          <span className="text-[13px] font-medium text-foreground">{task.description}</span>
                          {((task as any).tags ?? []).length > 0 && (
                            <div className="flex gap-1 ml-1">
                              {((task as any).tags as string[]).slice(0, 3).map((tag: string) => {
                                const tagDef = AVAILABLE_TAGS.find(t => t.label === tag);
                                return (
                                  <span key={tag} className={`inline-flex px-1.5 py-[0.5px] rounded-full text-[8px] font-semibold border ${tagDef?.activeCls ?? "bg-muted text-muted-foreground border-border"}`}>
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, task.status, v as TaskStatus)}>
                          <SelectTrigger className={`h-[26px] w-auto border-0 px-2.5 text-[11px] font-medium rounded-full shadow-none ${ss.cls}`}>
                            <SelectValue>{t.statuses[task.status]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(s => (
                              <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
                          <CalIcon className="h-3.5 w-3.5" />
                          {task.due_date ? format(parseISO(task.due_date), "MMM d") : "—"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <TaskAssigneeSelect task={task} />
                      </TableCell>

                      <TableCell>
                        <span className={`inline-flex px-1.5 py-[1px] rounded text-[9px] font-semibold border ${sourceStyles[src] ?? sourceStyles.manual}`}>
                          {sourceLabels[src] ?? src}
                        </span>
                      </TableCell>

                      <TableCell className="pr-3">
                        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditTask({ ...task })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(task.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleSendEmail(task)} disabled={sendingEmail}>
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Completed Tasks */}
        <div className="border rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
            onClick={() => setShowCompleted(v => !v)}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Completed Tasks
              <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{completedTasks.length}</span>
            </div>
            {showCompleted ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showCompleted && (
            <div className="rounded-none border-border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">Assignee</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-28">Completed</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Source</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-36">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No completed tasks yet</TableCell>
                    </TableRow>
                  ) : completedTasks.map(task => {
                    const src = task.source ?? "manual";
                    return (
                      <TableRow key={task.id} className="border-b border-border/60 h-[52px] opacity-70">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                            <span className="text-[13px] line-through text-muted-foreground">{task.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{task.assignee_name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {task.due_date ? format(parseISO(task.due_date), "MMM d") : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-1.5 py-[1px] rounded text-[9px] font-semibold border ${sourceStyles[src] ?? sourceStyles.manual}`}>
                            {sourceLabels[src] ?? src}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, task.status, v as TaskStatus)}>
                            <SelectTrigger className={`h-[26px] w-auto border-0 px-2.5 text-[11px] font-medium rounded-full shadow-none ${statusStyles[task.status].cls}`}>
                              <SelectValue>{t.statuses[task.status]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(s => (
                                <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTask} onOpenChange={(v) => !v && setEditTask(null)}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="p-6 pb-0">
            <DialogHeader className="pb-5">
              <DialogTitle className="text-lg font-bold">{t.projectDetail.editTask}</DialogTitle>
            </DialogHeader>
          </div>
          {editTask && (
            <div className="px-6 pb-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t.projectTasksTab.title}</Label>
                <Input
                  value={editTask.description}
                  onChange={e => setEditTask({ ...editTask, description: e.target.value })}
                  className="h-11 rounded-xl border-2 border-accent/60 focus-visible:border-accent focus-visible:ring-accent/20 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t.tasks.status}</Label>
                  <Select value={editTask.status} onValueChange={v => { handleStatusChange(editTask.id, editTask.status, v as TaskStatus); setEditTask({ ...editTask, status: v }); }}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t.tasks.priority}</Label>
                  <Select value={editTask.priority} onValueChange={v => { updatePriority.mutate({ taskId: editTask.id, priority: v }); setEditTask({ ...editTask, priority: v }); }}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TaskPriority[]).map(p => (
                        <SelectItem key={p} value={p}>{t.priorities[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t.projectTasksTab.deliveryDate}</Label>
                  <Input
                    type="date"
                    value={editTask.due_date ?? ""}
                    onChange={e => { updateDueDate.mutate({ taskId: editTask.id, dueDate: e.target.value || null }); setEditTask({ ...editTask, due_date: e.target.value }); }}
                    className="h-11 rounded-xl bg-muted/40 border-border text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">{t.tasks.assignee}</Label>
                  <div className="h-11 flex items-center rounded-xl bg-muted/40 border border-border px-2">
                    <TaskAssigneeSelect task={editTask} />
                  </div>
                </div>
              </div>

              {editTask.source && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Source</Label>
                  <div className="flex items-center h-9">
                    <span className={`inline-flex px-2 py-1 rounded text-[11px] font-semibold border ${sourceStyles[editTask.source] ?? sourceStyles.manual}`}>
                      {sourceLabels[editTask.source] ?? editTask.source}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t.projectTasksTab.tags}</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map(tag => {
                    const selected = (editTask.tags ?? []).includes(tag.label);
                    return (
                      <button
                        key={tag.label}
                        type="button"
                        onClick={() => {
                          const current: string[] = editTask.tags ?? [];
                          const next = selected ? current.filter((t: string) => t !== tag.label) : [...current, tag.label];
                          setEditTask({ ...editTask, tags: next });
                        }}
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border cursor-pointer transition-all ${
                          selected
                            ? `${tag.activeCls} ring-2 ring-offset-1 ring-accent/30`
                            : "bg-muted/40 text-muted-foreground border-border opacity-60 hover:opacity-100"
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditTask(null)} className="h-10 px-6 rounded-xl">
                  {t.projectTasksTab.cancel}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await updateDetails.mutateAsync({
                        taskId: editTask.id,
                        description: editTask.description,
                        assignee_name: editTask.assignee_name,
                        tags: editTask.tags ?? [],
                      });
                      toast({ title: t.projectTasksTab.taskUpdated });
                      setEditTask(null);
                    } catch (e: any) {
                      toast({ title: t.common.error, description: e.message, variant: "destructive" });
                    }
                  }}
                  disabled={updateDetails.isPending}
                  className="h-10 px-6 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
                >
                  {updateDetails.isPending ? t.projectTasksTab.saving : t.projectTasksTab.save}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The task will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSingle} className="bg-destructive hover:bg-destructive/90 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} task(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All selected tasks will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              Delete {selectedIds.size} task(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={(v) => { setBulkStatusOpen(v); if (!v) setBulkStatusValue(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status for {selectedIds.size} task(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">New status</Label>
              <Select value={bulkStatusValue} onValueChange={v => setBulkStatusValue(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a status..." />
                </SelectTrigger>
                <SelectContent>
                  {(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as TaskStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setBulkStatusOpen(false); setBulkStatusValue(""); }}>Cancel</Button>
              <Button
                onClick={handleBulkStatusChange}
                disabled={!bulkStatusValue || updateStatus.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {updateStatus.isPending ? "Updating…" : "Apply"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} task(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Select user</Label>
              <Select value={bulkAssignUserId} onValueChange={setBulkAssignUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email ?? p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setBulkAssignOpen(false); setBulkAssignUserId(""); }}>Cancel</Button>
              <Button onClick={handleBulkAssign} disabled={!bulkAssignUserId || updateDetails.isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
