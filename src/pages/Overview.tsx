import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FolderKanban, CheckSquare, Users, LayoutGrid, ListTodo, TrendingUp, ArrowRight } from "lucide-react";
import { ProjectIcon } from "@/components/projects/IconPicker";
import { useProjects } from "@/hooks/useProjectData";
import { useKPIs, useProfiles, useTasks } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

const DONUT_COLORS = ["hsl(145, 55%, 40%)", "hsl(217, 91%, 60%)", "hsl(38, 90%, 50%)", "hsl(0, 65%, 51%)", "hsl(270, 60%, 55%)", "hsl(340, 70%, 55%)"];

export default function Overview() {
  const { data: projects, isLoading: projLoading } = useProjects();
  const { data: kpis, isLoading: kpiLoading } = useKPIs();
  const { data: profiles } = useProfiles();
  const { data: tasks } = useTasks();
  const { t } = useLanguage();

  const loading = projLoading || kpiLoading;

  const activeProjects = useMemo(() =>
    (projects ?? []).filter(p => p.status === "active").length,
    [projects]
  );

  const kpiCards = [
    { label: "Projects", value: projects?.length ?? 0, icon: LayoutGrid },
    { label: "Total Tasks", value: (tasks ?? []).filter(t => !!t.project_id).length, icon: ListTodo },
    { label: "Active Projects", value: activeProjects, icon: FolderKanban },
    { label: "Team Members", value: profiles?.length ?? 0, icon: Users },
  ];

  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, BLOCKED: 0 };
    (tasks ?? []).forEach(tk => { counts[tk.status] = (counts[tk.status] || 0) + 1; });
    return [
      { name: "To Do", value: counts.OPEN, fill: "hsl(var(--accent))" },
      { name: "In Progress", value: counts.IN_PROGRESS, fill: "hsl(var(--accent))" },
      { name: "Done", value: counts.COMPLETED, fill: "hsl(var(--accent))" },
      { name: "Blocked", value: counts.BLOCKED, fill: "hsl(var(--accent))" },
    ];
  }, [tasks]);

  const projectTaskData = useMemo(() =>
    (projects ?? []).filter(p => (p.task_count ?? 0) > 0).slice(0, 6).map((p, i) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
      value: p.task_count ?? 0,
      fill: DONUT_COLORS[i % DONUT_COLORS.length],
    })),
    [projects]
  );

  // Widget data
  const taskStatusSummary = useMemo(() => {
    const counts = { OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, BLOCKED: 0 };
    (tasks ?? []).forEach(tk => { counts[tk.status] = (counts[tk.status] || 0) + 1; });
    return counts;
  }, [tasks]);

  const projectStatusSummary = useMemo(() => {
    const counts = { planning: 0, active: 0, completed: 0, archived: 0 };
    (projects ?? []).forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [projects]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold">{t.dashboard.title}</h1>
        <p className="text-[13px] text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <kpi.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{kpi.label}</span>
              </div>
              {loading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tasks by Status - Bar Chart */}
        <Card className="shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Tasks by Status</h3>
            {(tasks ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusCounts} barCategoryGap="25%">
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
                No task data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Project - Donut Chart */}
        <Card className="shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Tasks by Project</h3>
            {projectTaskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={projectTaskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {projectTaskData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
                No projects with tasks
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Widgets */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dashboard Widgets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tasks Overview Widget */}
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Tasks Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">To Do</p>
                  <p className="text-xl font-bold">{taskStatusSummary.OPEN}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                  <p className="text-xl font-bold">{taskStatusSummary.IN_PROGRESS}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Done</p>
                  <p className="text-xl font-bold">{taskStatusSummary.COMPLETED}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                  <p className="text-xl font-bold">{taskStatusSummary.BLOCKED}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projects Overview Widget */}
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Projects Overview</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{(projects ?? []).length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-xl font-bold">{projectStatusSummary.active}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Planning</p>
                  <p className="text-xl font-bold">{projectStatusSummary.planning}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-xl font-bold">{projectStatusSummary.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Summary Widget */}
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">KPI Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                  <p className="text-xl font-bold">{kpis?.completionRate ?? 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-bold">{kpis?.overdueTasks ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Open Tasks</p>
                  <p className="text-xl font-bold">{kpis?.openTasks ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meetings</p>
                  <p className="text-xl font-bold">{kpis?.totalMeetings ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.projects.title}</h2>
          <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {projLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
        ) : (projects ?? []).length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="p-8 text-center">
              <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t.projects.noProjects}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(projects ?? []).slice(0, 6).map(project => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer h-full">
                  <div className="flex h-full">
                    <div className="w-1.5 shrink-0" style={{ backgroundColor: project.color }} />
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-sm flex items-center gap-1.5"><ProjectIcon name={project.icon} className="h-4 w-4 shrink-0" />{project.name}</h3>
                        <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">{project.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">{project.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {project.task_count}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {project.member_count}</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={project.completion_rate} className="h-1.5" />
                        <span className="text-[10px] text-muted-foreground">{project.completion_rate}%</span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
