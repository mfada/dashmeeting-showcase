import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ListChecks, MonitorPlay, FileText, Users, MessageCircle, TrendingUp, Bell, Clock, Settings, Sparkles, AlertTriangle } from "lucide-react";
import { useProject, useUpdateProject, useProjectTasks, useProjectStatusLog } from "@/hooks/useProjectData";
import { useIsProjectMember } from "@/hooks/useSupabaseData";
import { ProjectIcon } from "@/components/projects/IconPicker";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab";
import { ProjectDocumentsTab } from "@/components/projects/ProjectDocumentsTab";
import { ProjectMeetingsTab } from "@/components/projects/ProjectMeetingsTab";
import { ProjectTeamTab } from "@/components/projects/ProjectTeamTab";
import { ProjectNotesTab } from "@/components/projects/ProjectNotesTab";
import { ProjectChatTab } from "@/components/projects/ProjectChatTab";
import { ProjectKPIsTab } from "@/components/projects/ProjectKPIsTab";
import { toast } from "sonner";
import { format, parseISO, formatDistanceToNow } from "date-fns";

const tabTriggerClass = "rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 lg:px-4 py-3 gap-1.5 text-[13px] font-medium text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id);
  const { data: tasks = [] } = useProjectTasks(id);
  const { data: statusLog = [] } = useProjectStatusLog(id);
  const updateProject = useUpdateProject();
  const { isAdmin } = useAuth();
  const { data: isMember = false } = useIsProjectMember(id);
  const canEdit = isAdmin || isMember;
  const { t } = useLanguage();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editColor, setEditColor] = useState("");

  const overdueTasks = useMemo(() => {
    const now = new Date().toISOString();
    return tasks.filter(t => t.status !== "COMPLETED" && t.due_date && t.due_date < now);
  }, [tasks]);

  const recentTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  }, [tasks]);

  const openSettings = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || "");
    setEditStatus(project.status);
    setEditColor(project.color || "#3B82F6");
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    if (!id) return;
    updateProject.mutate(
      { id, name: editName, description: editDesc, status: editStatus, color: editColor },
      { onSuccess: () => { toast.success(t.projectSettings.projectUpdated); setSettingsOpen(false); } }
    );
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">{t.projects.notFound}</p>
      <Link to="/projects" className="text-accent text-sm hover:underline mt-2 inline-block">{t.projects.backToProjects}</Link>
    </div>
  );

  return (
    <div className="space-y-0 -mt-1">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <Link to="/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: project.color + "18", color: project.color }}>
            {project.icon ? <ProjectIcon name={project.icon} className="h-5 w-5" /> : "📢"}
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">{project.name}</h1>
            <p className="text-[11px] text-muted-foreground">{t.projectDetail.projectDashboard}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" onClick={openSettings}>
            <Settings className="h-4 w-4" />
          </Button>}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground relative">
                <Bell className="h-4 w-4" />
                {overdueTasks.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[8px] text-destructive-foreground flex items-center justify-center font-bold">
                    {overdueTasks.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <h4 className="font-semibold text-sm mb-3">{t.projectSettings.notifications}</h4>
              {overdueTasks.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-destructive mb-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {t.projectSettings.overdueTasks}</p>
                  {overdueTasks.slice(0, 5).map(tk => (
                    <div key={tk.id} className="text-xs text-muted-foreground py-1 border-b last:border-0">
                      <span className="truncate block">{tk.description}</span>
                      <span className="text-destructive text-[10px]">{t.dashboard.due} {format(parseISO(tk.due_date!), "MMM d")}</span>
                    </div>
                  ))}
                </div>
              )}
              {recentTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{t.projectSettings.recentlyUpdated}</p>
                  {recentTasks.map(tk => (
                    <div key={tk.id} className="text-xs text-muted-foreground py-1 border-b last:border-0 truncate">
                      {tk.description}
                    </div>
                  ))}
                </div>
              )}
              {overdueTasks.length === 0 && recentTasks.length === 0 && (
                <p className="text-xs text-muted-foreground">{t.projectSettings.noNotifications}</p>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground">
                <Clock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <h4 className="font-semibold text-sm mb-3">{t.projectSettings.activity}</h4>
              {statusLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.projectSettings.noActivity}</p>
              ) : (
                <div className="space-y-2">
                  {statusLog.map((log: any) => (
                    <div key={log.id} className="text-xs border-b last:border-0 pb-2">
                      <span className="font-medium">{log.changed_by_name}</span>{" "}
                      <span className="text-muted-foreground">{t.statusLog.moved}</span>{" "}
                      <span className="font-medium truncate inline-block max-w-[120px] align-bottom">{log.task_description}</span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.statuses[log.old_status as keyof typeof t.statuses] ?? log.old_status} → {t.statuses[log.new_status as keyof typeof t.statuses] ?? log.new_status} · {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.projectSettings.editProject}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.projectSettings.projectName}</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.projectSettings.description}</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.projectSettings.status}</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">{t.projectSettings.statusPlanning}</SelectItem>
                    <SelectItem value="active">{t.projectSettings.statusActive}</SelectItem>
                    <SelectItem value="completed">{t.projectSettings.statusCompleted}</SelectItem>
                    <SelectItem value="archived">{t.projectSettings.statusArchived}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.projectSettings.color}</Label>
                <Input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="h-9" />
              </div>
            </div>
            <Button onClick={saveSettings} disabled={updateProject.isPending} className="w-full">
              {t.projectSettings.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <div className="border-b border-border -mx-5 lg:-mx-7 px-5 lg:px-7">
          <ScrollArea className="w-full">
            <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none w-max">
              <TabsTrigger value="tasks" className={tabTriggerClass}>
                <ListChecks className="h-3.5 w-3.5" /> {t.projectDetail.tasks}
              </TabsTrigger>
              <TabsTrigger value="documents" className={tabTriggerClass}>
                <FileText className="h-3.5 w-3.5" /> {t.projectDetail.documents}
              </TabsTrigger>
              <TabsTrigger value="meetings" className={tabTriggerClass}>
                <MonitorPlay className="h-3.5 w-3.5" /> {t.projectDetail.meetings}
              </TabsTrigger>
              <TabsTrigger value="notes" className={tabTriggerClass}>
                <FileText className="h-3.5 w-3.5" /> {t.projectDetail.notes}
              </TabsTrigger>
              <TabsTrigger value="team" className={tabTriggerClass}>
                <Users className="h-3.5 w-3.5" /> {t.projectDetail.team}
              </TabsTrigger>
              <TabsTrigger value="aichat" className={tabTriggerClass}>
                <Sparkles className="h-3.5 w-3.5" /> {t.projectDetail.aiChat}
              </TabsTrigger>
              <TabsTrigger value="kpis" className={tabTriggerClass}>
                <TrendingUp className="h-3.5 w-3.5" /> KPIs
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        <TabsContent value="tasks" className="mt-0"><ProjectTasksTab projectId={id!} canEdit={canEdit} /></TabsContent>
        <TabsContent value="documents" className="mt-0"><ProjectDocumentsTab projectId={id!} canEdit={canEdit} /></TabsContent>
        <TabsContent value="meetings" className="mt-0"><ProjectMeetingsTab projectId={id!} canEdit={canEdit} /></TabsContent>
        <TabsContent value="team" className="mt-0"><ProjectTeamTab projectId={id!} canEdit={canEdit} /></TabsContent>
        <TabsContent value="notes" className="mt-0"><ProjectNotesTab projectId={id!} canEdit={canEdit} /></TabsContent>
        <TabsContent value="aichat" className="mt-0"><ProjectChatTab projectId={id!} projectName={project.name} /></TabsContent>
        <TabsContent value="kpis" className="mt-0"><ProjectKPIsTab projectId={id!} /></TabsContent>
      </Tabs>
    </div>
  );
}
