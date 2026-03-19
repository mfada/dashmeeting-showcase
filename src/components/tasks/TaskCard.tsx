import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CalendarIcon, GripVertical, Lock } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Task, TaskStatus, TaskDependency } from "@/types";
import TaskDependencyDialog from "./TaskDependencyDialog";
import TaskAssigneeSelect from "./TaskAssigneeSelect";
import { useUpdateTaskDueDate, useUpdateTaskPriority } from "@/hooks/useSupabaseData";
import { toast } from "@/hooks/use-toast";

const priorityColor: Record<string, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-foreground",
  HIGH: "text-warning",
  CRITICAL: "text-destructive font-semibold",
};

interface TaskCardProps {
  task: Task;
  allTasks: Task[];
  dependencies: TaskDependency[];
  onStatusChange: (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus) => void;
  onBlockedByDeps?: boolean;
}

export default function TaskCard({ task, allTasks, dependencies, onStatusChange, onBlockedByDeps }: TaskCardProps) {
  const isOverdue = task.status !== "COMPLETED" && task.due_date && isBefore(parseISO(task.due_date), new Date());
  const needsProject = !task.project_id;
  const updateDueDate = useUpdateTaskDueDate();
  const updatePriority = useUpdateTaskPriority();
  const { t } = useLanguage();

  const handlePriorityChange = (val: string) => {
    updatePriority.mutate(
      { taskId: task.id, priority: val },
      {
        onSuccess: () => toast({ title: t.tasks.priorityUpdated }),
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleDateSelect = (date: Date | undefined) => {
    const dueDate = date ? format(date, "yyyy-MM-dd") : null;
    updateDueDate.mutate(
      { taskId: task.id, dueDate },
      {
        onSuccess: () => toast({ title: t.tasks.dueDateUpdated }),
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: "OPEN", label: t.statuses.OPEN },
    { value: "IN_PROGRESS", label: t.statuses.IN_PROGRESS },
    { value: "BLOCKED", label: t.statuses.BLOCKED },
    { value: "COMPLETED", label: t.statuses.COMPLETED },
  ];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.setData("oldStatus", task.status);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2 ${onBlockedByDeps ? "border-destructive/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm font-medium leading-snug flex-1 prose prose-sm dark:prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{task.description}</ReactMarkdown></div>
        {onBlockedByDeps && <Lock className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
      </div>

      {needsProject && (
        <p className="text-[10px] text-warning flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {t.tasks.needsProject}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={task.priority} onValueChange={handlePriorityChange}>
          <SelectTrigger className={`h-6 w-auto text-[10px] border-none px-2 gap-1 ${priorityColor[task.priority]}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
              <SelectItem key={p} value={p} className={`text-xs ${priorityColor[p]}`}>{t.priorities[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TaskAssigneeSelect task={task} disabled={needsProject} />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 w-full justify-start text-xs font-normal",
              !task.due_date && "text-muted-foreground",
              isOverdue && "border-destructive/40 text-destructive"
            )}
          >
            {isOverdue && <AlertCircle className="h-3 w-3 mr-1" />}
            <CalendarIcon className="h-3 w-3 mr-1" />
            {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : t.tasks.setDueDate}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={task.due_date ? parseISO(task.due_date) : undefined}
            onSelect={handleDateSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {task.meeting_title && (
        <p className="text-[11px] text-muted-foreground truncate">{task.meeting_title}</p>
      )}

      <TaskDependencyDialog task={task} allTasks={allTasks} dependencies={dependencies} />

      <Select
        value={task.status}
        onValueChange={(val) => onStatusChange(task.id, task.status, val as TaskStatus)}
        disabled={needsProject}
      >
        <SelectTrigger className="h-7 text-xs w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
