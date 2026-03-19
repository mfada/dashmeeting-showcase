import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, AlertCircle, LayoutGrid, List, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useTasks, useUpdateTaskStatus, useTaskDependencies } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO, isBefore } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { TaskStatus, TaskPriority } from "@/types";
import KanbanColumn from "@/components/tasks/KanbanColumn";
import TaskAssigneeSelect from "@/components/tasks/TaskAssigneeSelect";
import StatusLog from "@/components/tasks/StatusLog";

const statusColor: Record<TaskStatus, string> = {
  OPEN: "bg-warning/10 text-warning border-warning/20",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/20",
  BLOCKED: "bg-destructive/10 text-destructive border-destructive/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
};

const priorityColor: Record<TaskPriority, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-foreground",
  HIGH: "text-warning",
  CRITICAL: "text-destructive font-semibold",
};

const KANBAN_COLUMNS: TaskStatus[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"];

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: tasks, isLoading } = useTasks();
  const { data: dependencies } = useTaskDependencies();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const updateStatus = useUpdateTaskStatus();

  // Only project tasks count in dashboards and main view
  const allTasks = (tasks ?? []).filter(tk => !!tk.project_id);
  const allDeps = dependencies ?? [];

  const blockedTaskIds = new Set<string>();
  for (const dep of allDeps) {
    if (dep.depends_on_task && dep.depends_on_task.status !== "COMPLETED") {
      blockedTaskIds.add(dep.task_id);
    }
  }

  // Split active vs completed
  const activeTasks = allTasks.filter(tk => tk.status !== "COMPLETED");
  const completedTasks = allTasks.filter(tk => tk.status === "COMPLETED");

  const filterTasks = (list: typeof allTasks) => list.filter((tk) => {
    const matchSearch = tk.description.toLowerCase().includes(search.toLowerCase()) ||
      tk.assignee_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || statusFilter === "active" || tk.status === statusFilter;
    const matchPriority = priorityFilter === "all" || tk.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const filteredActive = filterTasks(activeTasks);
  const filteredCompleted = filterTasks(completedTasks);

  // Kanban uses all project tasks (all statuses)
  const filteredAll = filterTasks(allTasks);

  const handleStatusChange = (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus) => {
    if (oldStatus === newStatus || !user) return;
    if (newStatus === "COMPLETED" && blockedTaskIds.has(taskId)) {
      toast({ title: t.tasks.cannotComplete, description: t.tasks.incompleteDeps, variant: "destructive" });
      return;
    }
    updateStatus.mutate(
      { taskId, oldStatus, newStatus, changedBy: user.id, changedByName: profile?.full_name || user.email || "Unknown" },
      {
        onSuccess: () => toast({ title: t.tasks.statusUpdated }),
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const exportCSV = () => {
    const headers = [t.tasks.task, t.tasks.assignee, t.tasks.status, t.tasks.priority, t.tasks.dueDate, t.tasks.meetingCol];
    const rows = filteredActive.map((tk) => [tk.description, tk.assignee_name, tk.status, tk.priority, tk.due_date || "", tk.meeting_title || ""]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tasks-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const TaskRow = ({ tk }: { tk: typeof allTasks[0] }) => {
    const isOverdue = tk.status !== "COMPLETED" && tk.due_date && isBefore(parseISO(tk.due_date), new Date());
    const missingData = !tk.assignee_user_id || !tk.due_date;
    return (
      <TableRow key={tk.id}>
        <TableCell className="max-w-xs">
          <div className="flex items-start gap-2">
            {missingData && tk.status !== "COMPLETED" && <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />}
            <span className="text-sm">{tk.description}</span>
          </div>
        </TableCell>
        <TableCell><TaskAssigneeSelect task={tk} /></TableCell>
        <TableCell><span className={`text-sm ${priorityColor[tk.priority]}`}>{t.priorities[tk.priority]}</span></TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-[10px] ${statusColor[tk.status]}`}>{t.statuses[tk.status]}</Badge>
        </TableCell>
        <TableCell className={`text-sm ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {tk.due_date ? format(parseISO(tk.due_date), "MMM d, yyyy") : "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{tk.meeting_title}</TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.tasks.title}</h1>
          <p className="text-sm text-muted-foreground">{activeTasks.length} active · {completedTasks.length} completed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" className="rounded-r-none" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" className="rounded-l-none" onClick={() => setView("table")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> {t.tasks.exportCSV}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.tasks.searchTasks} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {view === "table" && (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder={t.tasks.status} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="all">{t.tasks.allStatus}</SelectItem>
                {(["OPEN", "IN_PROGRESS", "BLOCKED"] as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder={t.tasks.priority} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.tasks.allPriority}</SelectItem>
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                  <SelectItem key={p} value={p}>{t.priorities[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={filteredAll.filter((tk) => tk.status === status)}
              allTasks={allTasks}
              dependencies={allDeps}
              blockedTaskIds={blockedTaskIds}
              onStatusChange={handleStatusChange}
              onDrop={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Active Tasks */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.tasks.task}</TableHead>
                    <TableHead>{t.tasks.assignee}</TableHead>
                    <TableHead>{t.tasks.priority}</TableHead>
                    <TableHead>{t.tasks.status}</TableHead>
                    <TableHead>{t.tasks.dueDate}</TableHead>
                    <TableHead>{t.tasks.meetingCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActive.map((tk) => <TaskRow key={tk.id} tk={tk} />)}
                </TableBody>
              </Table>
              {filteredActive.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">{t.tasks.noTasksMatch}</div>
              )}
            </CardContent>
          </Card>

          {/* Completed Tasks — collapsible */}
          <div className="border rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
              onClick={() => setShowCompleted(v => !v)}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Completed Tasks
                <Badge variant="secondary" className="text-[10px]">{filteredCompleted.length}</Badge>
              </div>
              {showCompleted ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showCompleted && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.tasks.task}</TableHead>
                    <TableHead>{t.tasks.assignee}</TableHead>
                    <TableHead>{t.tasks.priority}</TableHead>
                    <TableHead>{t.tasks.status}</TableHead>
                    <TableHead>{t.tasks.dueDate}</TableHead>
                    <TableHead>{t.tasks.meetingCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompleted.map((tk) => <TaskRow key={tk.id} tk={tk} />)}
                  {filteredCompleted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No completed tasks</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      <StatusLog />
    </div>
  );
}
