import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { CalendarDays, CheckSquare, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { useKPIs, useMeetings, useTasks } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { format, parseISO, isBefore } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useKPIs();
  const { data: meetings, isLoading: meetingsLoading } = useMeetings();
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { t } = useLanguage();

  const loading = kpisLoading || meetingsLoading || tasksLoading;

  const kpiCards = [
    { label: t.dashboard.totalMeetings, value: kpis?.totalMeetings ?? 0, icon: CalendarDays, color: "text-primary" },
    { label: t.dashboard.openTasks, value: kpis?.openTasks ?? 0, icon: CheckSquare, color: "text-warning" },
    { label: t.dashboard.overdueTasks, value: kpis?.overdueTasks ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: t.dashboard.completionRate, value: `${kpis?.completionRate ?? 0}%`, icon: TrendingUp, color: "text-success" },
  ];

  const overdueTasks = (tasks ?? []).filter(
    (t) => t.status !== "COMPLETED" && t.due_date && isBefore(parseISO(t.due_date), new Date())
  );

  const meetingsByMonth = (meetings ?? []).reduce<Record<string, number>>((acc, m) => {
    const key = format(parseISO(m.date), "MMM yyyy");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const chartMeetings = Object.entries(meetingsByMonth).slice(-5).map(([month, count]) => ({ month, count }));

  const tasksByMonth = (tasks ?? []).reduce<Record<string, { completed: number; total: number }>>((acc, tk) => {
    const key = format(parseISO(tk.created_at), "MMM yyyy");
    if (!acc[key]) acc[key] = { completed: 0, total: 0 };
    acc[key].total++;
    if (tk.status === "COMPLETED") acc[key].completed++;
    return acc;
  }, {});
  const chartTasks = Object.entries(tasksByMonth).slice(-5).map(([month, d]) => ({ month, ...d }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{kpi.value}</p>}
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t.dashboard.meetingsOverTime}</CardTitle></CardHeader>
          <CardContent>
            {chartMeetings.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartMeetings}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-16 text-center">{t.dashboard.noMeetingData}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t.dashboard.taskCompletionTrend}</CardTitle></CardHeader>
          <CardContent>
            {chartTasks.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartTasks}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-16 text-center">{t.dashboard.noTaskData}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t.dashboard.recentMeetings}</CardTitle>
              <Link to="/meetings" className="text-xs text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {meetingsLoading ? <Skeleton className="h-20 w-full" /> : (meetings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.dashboard.noMeetings}</p>
            ) : (
              (meetings ?? []).slice(0, 3).map((m) => (
                <Link key={m.id} to={`/meetings/${m.id}`} className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(m.date), "MMM d, yyyy")}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{m.source}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{m.general_summary}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> {t.dashboard.overdueTasks}
              </CardTitle>
              <Link to="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksLoading ? <Skeleton className="h-20 w-full" /> : overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.dashboard.noOverdueTasks}</p>
            ) : (
              overdueTasks.map((tk) => (
                <div key={tk.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-medium">{tk.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">{tk.assignee_name}</span>
                    <span className="text-xs text-destructive font-medium">{t.dashboard.due} {tk.due_date && format(parseISO(tk.due_date), "MMM d")}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
