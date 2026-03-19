import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckSquare, Users, Search, FolderKanban } from "lucide-react";
import { useProjects, useCreateProject } from "@/hooks/useProjectData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { IconPicker, ProjectIcon } from "@/components/projects/IconPicker";

const COLOR_OPTIONS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#3B82F6", status: "active", icon: null as string | null });

  const filtered = (projects ?? []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createProject.mutateAsync(form);
      toast({ title: t.projects.projectCreated });
      setOpen(false);
      setForm({ name: "", description: "", color: "#3B82F6", status: "active", icon: null });
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.projects.title}</h1>
          <p className="text-sm text-muted-foreground">{(projects ?? []).length} {t.projects.projectsCount}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t.projects.newProject}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.projects.newProject}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Icon</Label><div className="mt-1"><IconPicker value={form.icon} onChange={icon => setForm(f => ({ ...f, icon }))} /></div></div>
                <div><Label>{t.projects.name}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>{t.projects.description}</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>{t.projects.status}</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t.projects.color}</Label>
                  <div className="flex gap-2 mt-1">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={createProject.isPending} className="w-full">
                  {createProject.isPending ? "…" : t.projects.create}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t.projects.searchProjects} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t.projects.noProjects}</p>
          </div>
        ) : (
          filtered.map(project => (
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
          ))
        )}
      </div>
    </div>
  );
}
