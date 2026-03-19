import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectTasks, useProjectMeetings } from "@/hooks/useProjectData";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { ListChecks, AlertTriangle, CheckCircle2, TrendingUp, MonitorPlay } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "hsl(var(--primary))",
  IN_PROGRESS: "hsl(var(--warning))",
  COMPLETED: "hsl(var(--success))",
  BLOCKED: "hsl(var(--destructive))",
};

interface Props { projectId: string; }

export function ProjectKPIsTab({ projectId }: Props) {
  const { data: tasks = [] } = useProjectTasks(projectId);
  const { data: meetings = [] } = useProjectMeetings(projectId);

  const kpis = useMemo(() => {
    const now = new Date().toISOString();
    const total = tasks.length;
    const open = tasks.filter(t => t.status !== "COMPLETED").length;
    const overdue = tasks.filter(t => t.status !== "COMPLETED" && t.due_date && t.due_date < now).length;
    const completed = tasks.filter(t => t.status === "COMPLETED").length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, open, overdue, completed, rate, totalMeetings: meetings.length };
  }, [tasks, meetings]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const trendData = useMemo(() => {
    const monthMap = new Map<string, { total: number; completed: number }>();
    tasks.forEach(t => {
      const key = format(startOfMonth(parseISO(t.created_at)), "yyyy-MM");
      if (!monthMap.has(key)) monthMap.set(key, { total: 0, completed: 0 });
      const entry = monthMap.get(key)!;
      entry.total++;
      if (t.status === "COMPLETED") entry.completed++;
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month: format(parseISO(month + "-01"), "MMM yy"), ...d }));
  }, [tasks]);

  const assigneeData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.assignee_name] = (counts[t.assignee_name] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [tasks]);

  return (
    <div className="space-y-6 pt-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Tasks", value: kpis.total, icon: ListChecks, color: "text-primary" },
          { label: "Open Tasks", value: kpis.open, icon: ListChecks, color: "text-warning" },
          { label: "Overdue", value: kpis.overdue, icon: AlertTriangle, color: "text-destructive" },
          { label: "Completion", value: `${kpis.rate}%`, icon: CheckCircle2, color: "text-success" },
          { label: "Meetings", value: kpis.totalMeetings, icon: MonitorPlay, color: "text-primary" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Task Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {statusData.map(entry => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Task Completion Trend</CardTitle></CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total" strokeWidth={2} />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" name="Completed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignee Chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks by Assignee</CardTitle></CardHeader>
        <CardContent>
          {assigneeData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tasks yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, assigneeData.length * 36)}>
              <BarChart data={assigneeData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={75} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
