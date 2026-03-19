import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useMeetings, useAssignMeetingProject } from "@/hooks/useSupabaseData";
import { useProjects } from "@/hooks/useProjectData";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

export default function Meetings() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const { data: meetings, isLoading } = useMeetings();
  const { data: projects } = useProjects();
  const { t } = useLanguage();
  const assignProject = useAssignMeetingProject();

  const filtered = (meetings ?? []).filter((m) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.general_summary.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "all" || m.source === sourceFilter;
    const matchProject = projectFilter === "all" ||
      (projectFilter === "unassigned" ? !m.project_id : m.project_id === projectFilter);
    const matchAttendee = !attendeeSearch.trim() ||
      (m.participants ?? []).some(p => p.name.toLowerCase().includes(attendeeSearch.toLowerCase()));
    return matchSearch && matchSource && matchProject && matchAttendee;
  });

  const handleAssignProject = (meetingId: string, projectId: string, e: React.MouseEvent | Event) => {
    if ('stopPropagation' in e) e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();
    assignProject.mutate(
      { meetingId, projectId },
      {
        onSuccess: () => toast({ title: t.meetings.projectAssigned }),
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.meetings.title}</h1>
        <p className="text-sm text-muted-foreground">{meetings?.length ?? 0} {t.meetings.meetingsIngested}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.meetings.searchMeetings} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t.imports.source} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.meetings.allSources}</SelectItem>
            <SelectItem value="fireflies">Fireflies</SelectItem>
            <SelectItem value="file_upload">File Upload</SelectItem>
            <SelectItem value="plaud">Plaud</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.meetingsFilters.allProjects} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.meetingsFilters.allProjects}</SelectItem>
            <SelectItem value="unassigned">{t.meetings.unassigned}</SelectItem>
            {(projects ?? []).map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.meetingsFilters.searchAttendees} value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : filtered.map((m) => (
          <Link key={m.id} to={`/meetings/${m.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-sm font-semibold truncate">{m.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{format(parseISO(m.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
                    <div className="text-sm text-muted-foreground mt-2 line-clamp-2 prose prose-sm dark:prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{m.general_summary ?? ""}</ReactMarkdown></div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {m.tags?.map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-[10px]">{tag.name}</Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {m.participants?.length || 0} {t.meetings.participants} · {m.topics?.length || 0} {t.meetings.topics}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{m.source}</Badge>
                    <div onClick={(e) => e.preventDefault()}>
                      {m.project_id ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {projectMap.get(m.project_id) ?? t.projects.title}
                        </Badge>
                      ) : (
                        <Select
                          onValueChange={(val) => {
                            handleAssignProject(m.id, val, { stopPropagation: () => {}, preventDefault: () => {} } as any);
                          }}
                        >
                          <SelectTrigger className="h-6 w-auto text-[10px] border-warning/40 text-warning gap-1 px-2" onClick={(e) => e.preventDefault()}>
                            <AlertTriangle className="h-3 w-3" />
                            <SelectValue placeholder={t.meetings.unassigned} />
                          </SelectTrigger>
                          <SelectContent>
                            {(projects ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t.meetings.noMeetingsFound}</p>
          </div>
        )}
      </div>
    </div>
  );
}
