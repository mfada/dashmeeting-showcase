import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RefreshCw, Search, CalendarDays, Clock, MapPin, User } from "lucide-react";
import { useCalendarData } from "@/hooks/useProjectData";
import { useProjects } from "@/hooks/useProjectData";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isToday, parseISO, addMonths, subMonths, startOfToday,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOffice365Integration } from "@/hooks/useOffice365";
import { useQueryClient } from "@tanstack/react-query";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  description?: string | null;
  source: string;
  project_id?: string | null;
  is_all_day?: boolean;
}

interface CalendarMeeting {
  id: string;
  title: string;
  date: string;
  project_id?: string | null;
  meeting_participants?: { name: string }[];
}

interface CalendarTask {
  id: string;
  description: string;
  due_date: string;
  status: string;
  assignee_name: string;
  project_id?: string | null;
}

type DayItem =
  | { kind: "meeting"; data: CalendarMeeting }
  | { kind: "event"; data: CalendarEvent }
  | { kind: "task"; data: CalendarTask };

// Sync window: 3 months back, 6 months forward (matches edge function)
const WINDOW_START = subMonths(startOfToday(), 3);
const WINDOW_END = addMonths(startOfToday(), 6);

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [syncing, setSyncing] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [showMeetings, setShowMeetings] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showO365, setShowO365] = useState(true);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);

  const { data: calendarData, refetch: refetchAll, isLoading } = useCalendarData(WINDOW_START, WINDOW_END);
  const { data: projects } = useProjects();
  const { data: integration } = useOffice365Integration();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const allMeetings: CalendarMeeting[] = calendarData?.meetings ?? [];
  const allTasks: CalendarTask[] = calendarData?.tasks ?? [];
  const allEvents: CalendarEvent[] = calendarData?.events ?? [];

  const syncCalendar = useCallback(async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-office365", { body: {} });
      if (error) throw error;
      toast.success(t.calendar.syncSuccess);
      await refetchAll();
      qc.invalidateQueries({ queryKey: ["office365-integration"] });
    } catch {
      toast.error(t.calendar.syncError);
    } finally {
      setSyncing(false);
    }
  }, [t, refetchAll, qc]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const filteredMeetings = useMemo(() => {
    if (!showMeetings) return [];
    return allMeetings.filter((m) => {
      const matchProject = projectFilter === "all" || m.project_id === projectFilter;
      const matchAssignee =
        !assigneeSearch.trim() ||
        (m.meeting_participants ?? []).some((p) =>
          p.name.toLowerCase().includes(assigneeSearch.toLowerCase())
        );
      return matchProject && matchAssignee;
    });
  }, [allMeetings, showMeetings, projectFilter, assigneeSearch]);

  const filteredTasks = useMemo(() => {
    if (!showTasks) return [];
    return allTasks.filter((t) => {
      const matchProject = projectFilter === "all" || t.project_id === projectFilter;
      const matchAssignee =
        !assigneeSearch.trim() ||
        t.assignee_name?.toLowerCase().includes(assigneeSearch.toLowerCase());
      return matchProject && matchAssignee;
    });
  }, [allTasks, showTasks, projectFilter, assigneeSearch]);

  const filteredEvents = useMemo(() => {
    if (!showO365) return [];
    return allEvents.filter((ev) => projectFilter === "all" || ev.project_id === projectFilter);
  }, [allEvents, showO365, projectFilter]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();

    const add = (key: string, item: DayItem) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };

    for (const m of filteredMeetings) {
      const key = format(parseISO(m.date), "yyyy-MM-dd");
      add(key, { kind: "meeting", data: m });
    }
    for (const ev of filteredEvents) {
      const key = format(parseISO(ev.start_time), "yyyy-MM-dd");
      add(key, { kind: "event", data: ev });
    }
    for (const tk of filteredTasks) {
      if (!tk.due_date) continue;
      const key = format(parseISO(tk.due_date), "yyyy-MM-dd");
      add(key, { kind: "task", data: tk });
    }

    return map;
  }, [filteredMeetings, filteredEvents, filteredTasks]);

  const monthKey = format(currentMonth, "yyyy-MM");
  const hasAnyThisMonth = useMemo(() => {
    for (const key of itemsByDate.keys()) {
      if (key.startsWith(monthKey)) return true;
    }
    return false;
  }, [itemsByDate, monthKey]);

  // Stats for header
  const totalO365 = allEvents.length;
  const totalMeetings = allMeetings.length;
  const totalTasks = allTasks.length;

  function getItemLabel(item: DayItem): string {
    if (item.kind === "meeting") return item.data.title;
    if (item.kind === "event") return item.data.title;
    return item.data.description;
  }

  function getItemClass(item: DayItem): string {
    if (item.kind === "meeting") return "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer";
    if (item.kind === "event") return "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 cursor-pointer";
    const done = (item.data as CalendarTask).status === "COMPLETED";
    return done
      ? "bg-success/10 text-success line-through"
      : "bg-warning/10 text-warning hover:bg-warning/20 cursor-pointer";
  }

  function handleItemClick(item: DayItem) {
    if (item.kind === "meeting") {
      navigate(`/meetings/${item.data.id}`);
    } else {
      setSelectedItem(item);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.calendar.title}</h1>
          <p className="text-sm text-muted-foreground">{t.calendar.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live stats */}
          {!isLoading && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {totalO365 > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/60" />
                  {totalO365} Office365
                </span>
              )}
              {totalMeetings > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-primary/40" />
                  {totalMeetings} meetings
                </span>
              )}
              {totalTasks > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-warning/60" />
                  {totalTasks} tasks
                </span>
              )}
            </div>
          )}
          {integration && (
            <Button size="sm" variant="outline" onClick={syncCalendar} disabled={syncing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? t.calendar.syncing : t.calendar.syncCalendar}
            </Button>
          )}
        </div>
      </div>

      {/* Office 365 not connected */}
      {!integration && !isLoading && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">{t.office365.connectBanner}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 shrink-0"
            onClick={() => navigate("/settings")}
          >
            {t.office365.connect}
          </Button>
        </div>
      )}

      {/* Connected but no events */}
      {integration && !isLoading && allEvents.length === 0 && showO365 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No Office365 events found. Try syncing to fetch your latest calendar.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 shrink-0 gap-1.5"
            onClick={syncCalendar}
            disabled={syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? t.calendar.syncing : t.office365.syncNow}
          </Button>
        </div>
      )}

      {/* Legend + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder={t.calendarFilters.allProjects} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.calendarFilters.allProjects}</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={showMeetings} onCheckedChange={(v) => setShowMeetings(!!v)} className="h-3.5 w-3.5" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-primary/40" />
              {t.calendar.meeting}
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={showTasks} onCheckedChange={(v) => setShowTasks(!!v)} className="h-3.5 w-3.5" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-warning/60" />
              {t.calendar.taskDue}
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={showO365} onCheckedChange={(v) => setShowO365(!!v)} className="h-3.5 w-3.5" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/60" />
              {t.calendar.o365Event}
            </span>
          </label>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t.calendarFilters.searchAssignee}
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            className="pl-7 h-9 w-[180px] text-xs"
          />
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {t.calendar.weekdays.map((d) => (
                  <div key={d} className="bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
                    {d}
                  </div>
                ))}

                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="bg-card min-h-[100px] p-1" />
                ))}

                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const items = itemsByDate.get(key) ?? [];
                  const today = isToday(day);
                  const maxVisible = 3;
                  const visible = items.slice(0, maxVisible);
                  const overflow = items.length - visible.length;

                  return (
                    <div
                      key={key}
                      className={`bg-card min-h-[100px] p-1.5 transition-colors hover:bg-muted/30 ${today ? "ring-2 ring-inset ring-primary/30" : ""}`}
                    >
                      <div className={`text-xs font-medium mb-1 ${today ? "text-primary font-bold" : "text-foreground"}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {visible.map((item, idx) => (
                          <button
                            key={`${item.kind}-${idx}`}
                            onClick={() => handleItemClick(item)}
                            className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-colors ${getItemClass(item)}`}
                            title={getItemLabel(item)}
                          >
                            {item.kind === "event" && !item.data.is_all_day && (
                              <span className="opacity-70 mr-0.5">
                                {format(parseISO(item.data.start_time), "HH:mm")}
                              </span>
                            )}
                            {getItemLabel(item)}
                          </button>
                        ))}
                        {overflow > 0 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{overflow} {t.calendar.more}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!hasAnyThisMonth && allMeetings.length + allTasks.length + allEvents.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No events in {format(currentMonth, "MMMM yyyy")}.
                </p>
              )}
              {!hasAnyThisMonth && (allMeetings.length + allTasks.length + allEvents.length) > 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No events this month — try navigating to a different month.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail popover for events & tasks */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="max-w-sm">
          {selectedItem?.kind === "event" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">{selectedItem.data.title}</DialogTitle>
                <Badge variant="outline" className="w-fit text-[10px] border-blue-200 text-blue-600">Office365</Badge>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {selectedItem.data.is_all_day
                      ? "All day · " + format(parseISO(selectedItem.data.start_time), "MMM d, yyyy")
                      : format(parseISO(selectedItem.data.start_time), "MMM d, yyyy · HH:mm") +
                        " – " +
                        format(parseISO(selectedItem.data.end_time), "HH:mm")}
                  </span>
                </div>
                {selectedItem.data.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{selectedItem.data.location}</span>
                  </div>
                )}
                {selectedItem.data.description && (
                  <p className="text-muted-foreground text-xs leading-relaxed border-t pt-2">
                    {selectedItem.data.description}
                  </p>
                )}
              </div>
            </>
          )}
          {selectedItem?.kind === "task" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">{selectedItem.data.description}</DialogTitle>
                <Badge
                  variant="outline"
                  className={`w-fit text-[10px] ${
                    selectedItem.data.status === "COMPLETED"
                      ? "border-green-200 text-green-600"
                      : "border-amber-200 text-amber-600"
                  }`}
                >
                  {selectedItem.data.status}
                </Badge>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Due {format(parseISO(selectedItem.data.due_date), "MMM d, yyyy")}</span>
                </div>
                {selectedItem.data.assignee_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{selectedItem.data.assignee_name}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
