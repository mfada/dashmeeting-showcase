import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useMeetings, useTasks } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["hsl(38, 92%, 50%)", "hsl(173, 58%, 39%)", "hsl(142, 71%, 45%)"];

export default function Analytics() {
  const { data: meetings, isLoading: mLoading } = useMeetings();
  const { data: tasks, isLoading: tLoading } = useTasks();
  const { t } = useLanguage();
  const loading = mLoading || tLoading;

  const allTasks = tasks ?? [];
  const allMeetings = meetings ?? [];

  // Meetings per month
  const meetingsByMonth = allMeetings.reduce<Record<string, number>>((acc, m) => {
    const key = format(parseISO(m.date), "MMM");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const chartMeetings = Object.entries(meetingsByMonth).map(([month, count]) => ({ month, count }));

  // Task completion trend
  const tasksByMonth = allTasks.reduce<Record<string, { completed: number; total: number }>>((acc, t) => {
    const key = format(parseISO(t.created_at), "MMM");
    if (!acc[key]) acc[key] = { completed: 0, total: 0 };
    acc[key].total++;
    if (t.status === "COMPLETED") acc[key].completed++;
    return acc;
  }, {});
  const chartTasks = Object.entries(tasksByMonth).map(([month, d]) => ({ month, ...d }));

  // Tasks by assignee
  const assigneeCounts = allTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.assignee_name] = (acc[t.assignee_name] || 0) + 1;
    return acc;
  }, {});
  const assigneeData = Object.entries(assigneeCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Status distribution
  const statusCounts = allTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: t.statuses[name as keyof typeof t.statuses] ?? name, value }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">{t.analytics.title}</h1></div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[320px] w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  const noData = allMeetings.length === 0 && allTasks.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.analytics.title}</h1>
        <p className="text-sm text-muted-foreground">{t.analytics.subtitle}</p>
      </div>

      {noData ? (
        <p className="text-sm text-muted-foreground text-center py-20">{t.analytics.noData}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t.analytics.meetingsPerMonth}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartMeetings}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t.analytics.taskCompletionTrend}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartTasks}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} name="Total" />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={t.statuses.COMPLETED} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t.analytics.tasksByAssignee}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={assigneeData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t.analytics.taskStatusDistribution}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
