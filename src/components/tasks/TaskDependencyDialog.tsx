import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link2, Plus, Search, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Task, TaskDependency } from "@/types";
import { useAddTaskDependency, useRemoveTaskDependency } from "@/hooks/useSupabaseData";
import { toast } from "@/hooks/use-toast";

interface TaskDependencyDialogProps {
  task: Task;
  allTasks: Task[];
  dependencies: TaskDependency[];
}

export default function TaskDependencyDialog({ task, allTasks, dependencies }: TaskDependencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const addDep = useAddTaskDependency();
  const removeDep = useRemoveTaskDependency();

  const taskDeps = dependencies.filter((d) => d.task_id === task.id);
  const depTaskIds = new Set(taskDeps.map((d) => d.depends_on_task_id));

  const availableTasks = allTasks.filter(
    (tk) => tk.id !== task.id && !depTaskIds.has(tk.id) &&
      tk.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (dependsOnId: string) => {
    addDep.mutate(
      { taskId: task.id, dependsOnTaskId: dependsOnId },
      {
        onSuccess: () => toast({ title: t.dependencies.dependencyAdded }),
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleRemove = (depId: string) => {
    removeDep.mutate(depId, {
      onSuccess: () => toast({ title: t.dependencies.dependencyRemoved }),
      onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
    });
  };

  const incompleteCount = taskDeps.filter((d) => d.depends_on_task?.status !== "COMPLETED").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Link2 className="h-3 w-3" />
          {taskDeps.length > 0 ? (
            <span>
              {taskDeps.length} {taskDeps.length > 1 ? t.tasks.depsPlural : t.tasks.deps}
              {incompleteCount > 0 && (
                <span className="text-destructive font-medium ml-1">({incompleteCount} {t.tasks.pending})</span>
              )}
            </span>
          ) : (
            <span>{t.tasks.addDependency}</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">
            {t.dependencies.dependenciesFor} {task.description}
          </DialogTitle>
        </DialogHeader>

        {taskDeps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t.dependencies.dependsOn}</p>
            {taskDeps.map((dep) => (
              <div key={dep.id} className="flex items-start gap-2 rounded-md border p-2.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 mt-0.5 ${dep.depends_on_task?.status === "COMPLETED" ? "text-success border-success/20" : "text-warning border-warning/20"}`}
                >
                  {t.statuses[dep.depends_on_task?.status as keyof typeof t.statuses] ?? "?"}
                </Badge>
                <span className="text-sm flex-1 break-words">{dep.depends_on_task?.description ?? "Unknown task"}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemove(dep.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground">{t.dependencies.addDependency}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t.dependencies.searchTasks}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {availableTasks.slice(0, 20).map((tk) => (
              <div
                key={tk.id}
                className="flex items-start gap-2 rounded-md border p-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleAdd(tk.id)}
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm flex-1 break-words">{tk.description}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{t.statuses[tk.status as keyof typeof t.statuses]}</Badge>
              </div>
            ))}
            {availableTasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{t.dependencies.noAvailableTasks}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
