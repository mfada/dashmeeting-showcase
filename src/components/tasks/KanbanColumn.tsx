import { useState } from "react";
import type { Task, TaskStatus, TaskDependency } from "@/types";
import { useLanguage } from "@/i18n/LanguageContext";
import TaskCard from "./TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  allTasks: Task[];
  dependencies: TaskDependency[];
  blockedTaskIds: Set<string>;
  onStatusChange: (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus) => void;
  onDrop: (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus) => void;
}

const columnColor: Record<TaskStatus, string> = {
  OPEN: "border-t-warning",
  IN_PROGRESS: "border-t-primary",
  BLOCKED: "border-t-destructive",
  COMPLETED: "border-t-success",
};

export default function KanbanColumn({ status, tasks, allTasks, dependencies, blockedTaskIds, onStatusChange, onDrop }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className={`flex flex-col rounded-lg border border-t-4 ${columnColor[status]} bg-muted/30 min-h-[400px] transition-colors ${dragOver ? "bg-muted/60" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData("taskId");
        const oldStatus = e.dataTransfer.getData("oldStatus") as TaskStatus;
        if (oldStatus !== status) onDrop(taskId, oldStatus, status);
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{t.statuses[status]}</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {tasks.map((tk) => (
          <TaskCard key={tk.id} task={tk} allTasks={allTasks} dependencies={dependencies} onStatusChange={onStatusChange} onBlockedByDeps={blockedTaskIds.has(tk.id)} />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">{t.tasks.noTasks}</p>
        )}
      </div>
    </div>
  );
}
