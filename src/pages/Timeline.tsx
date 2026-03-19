import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTasks, useTaskDependencies } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, Circle, Lock, AlertTriangle } from "lucide-react";
import type { Task, TaskStatus, TaskDependency } from "@/types";

const statusIcons: Record<TaskStatus, typeof Circle> = {
  OPEN: Circle,
  IN_PROGRESS: Circle,
  BLOCKED: Lock,
  COMPLETED: CheckCircle2,
};

const statusColorMap: Record<TaskStatus, string> = {
  OPEN: "text-warning",
  IN_PROGRESS: "text-primary",
  BLOCKED: "text-destructive",
  COMPLETED: "text-success",
};

const priorityColor: Record<string, string> = {
  LOW: "text-muted-foreground border-muted-foreground/20",
  MEDIUM: "text-foreground border-foreground/20",
  HIGH: "text-warning border-warning/20",
  CRITICAL: "text-destructive border-destructive/20",
};

interface TaskNode {
  task: Task;
  dependsOn: Task[];
  blockedBy: Task[];
  hasIncompleteDeps: boolean;
  depth: number;
}

function buildTaskGraph(tasks: Task[], deps: TaskDependency[]): TaskNode[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const dependsOnMap = new Map<string, Task[]>();
  const blockedByMap = new Map<string, Task[]>();

  for (const dep of deps) {
    const parent = taskMap.get(dep.depends_on_task_id);
    const child = taskMap.get(dep.task_id);
    if (parent && child) {
      if (!dependsOnMap.has(dep.task_id)) dependsOnMap.set(dep.task_id, []);
      dependsOnMap.get(dep.task_id)!.push(parent);
      if (!blockedByMap.has(dep.depends_on_task_id)) blockedByMap.set(dep.depends_on_task_id, []);
      blockedByMap.get(dep.depends_on_task_id)!.push(child);
    }
  }

  const depthMap = new Map<string, number>();
  function getDepth(id: string, visited: Set<string>): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const parents = dependsOnMap.get(id) ?? [];
    const d = parents.length === 0 ? 0 : Math.max(...parents.map((p) => getDepth(p.id, visited))) + 1;
    depthMap.set(id, d);
    return d;
  }
  for (const t of tasks) getDepth(t.id, new Set());

  return tasks.map((t) => {
    const depsOn = dependsOnMap.get(t.id) ?? [];
    return {
      task: t,
      dependsOn: depsOn,
      blockedBy: blockedByMap.get(t.id) ?? [],
      hasIncompleteDeps: depsOn.some((d) => d.status !== "COMPLETED"),
      depth: depthMap.get(t.id) ?? 0,
    };
  }).sort((a, b) => a.depth - b.depth || a.task.description.localeCompare(b.task.description));
}

export default function Timeline() {
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: deps, isLoading: depsLoading } = useTaskDependencies();
  const { t } = useLanguage();
  const isLoading = tasksLoading || depsLoading;

  const nodes = useMemo(() => buildTaskGraph(tasks ?? [], deps ?? []), [tasks, deps]);

  const levels = useMemo(() => {
    const grouped = new Map<number, TaskNode[]>();
    for (const n of nodes) {
      if (!grouped.has(n.depth)) grouped.set(n.depth, []);
      grouped.get(n.depth)!.push(n);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [nodes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.timeline.title}</h1>
        <p className="text-sm text-muted-foreground">{t.timeline.subtitle}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">{t.timeline.noTasksFound}</CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

          {levels.map(([depth, levelNodes]) => (
            <div key={depth} className="relative mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative z-10 flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  {depth === 0 ? t.timeline.start : `L${depth}`}
                </div>
                <div>
                  <h2 className="text-sm font-semibold">
                    {depth === 0 ? t.timeline.independentTasks : `${t.timeline.level} ${depth}`}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {depth === 0
                      ? t.timeline.noPrerequisites
                      : t.timeline.dependsOnLevel.replace("{level}", String(depth - 1))}
                  </p>
                </div>
              </div>

              <div className="ml-16 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {levelNodes.map((node) => {
                  const StatusIcon = statusIcons[node.task.status];
                  const color = statusColorMap[node.task.status];

                  return (
                    <Card key={node.task.id} className={`transition-shadow hover:shadow-md ${node.hasIncompleteDeps ? "border-destructive/30" : ""}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                          <p className="text-sm font-medium leading-snug flex-1 break-words">{node.task.description}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${color}`}>{t.statuses[node.task.status]}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${priorityColor[node.task.priority]}`}>{t.priorities[node.task.priority as keyof typeof t.priorities]}</Badge>
                          <span className="text-xs text-muted-foreground">{node.task.assignee_name}</span>
                        </div>

                        {node.dependsOn.length > 0 && (
                          <div className="space-y-1 pt-1 border-t">
                            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              {node.hasIncompleteDeps && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              {t.timeline.dependsOn}
                            </p>
                            {node.dependsOn.map((dep) => {
                              const DepIcon = statusIcons[dep.status];
                              const depColor = statusColorMap[dep.status];
                              return (
                                <div key={dep.id} className="flex items-start gap-1.5 text-xs">
                                  <DepIcon className={`h-3 w-3 mt-0.5 shrink-0 ${depColor}`} />
                                  <span className="break-words">{dep.description}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {node.blockedBy.length > 0 && (
                          <div className="space-y-1 pt-1 border-t">
                            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              {t.timeline.blocks}
                            </p>
                            {node.blockedBy.map((blocked) => (
                              <div key={blocked.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="break-words">{blocked.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
