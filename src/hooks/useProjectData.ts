import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Project, ProjectMember, ProjectDocument, Task, Meeting } from "@/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (projects ?? []).map((p: any) => p.id);
      if (ids.length === 0) return [];

      const [{ data: members }, { data: tasks }] = await Promise.all([
        supabase.from("project_members").select("project_id").in("project_id", ids),
        supabase.from("tasks").select("project_id, status").in("project_id", ids),
      ]);

      return (projects ?? []).map((p: any) => {
        const pTasks = (tasks ?? []).filter((t: any) => t.project_id === p.id);
        const completed = pTasks.filter((t: any) => t.status === "COMPLETED").length;
        return {
          ...p,
          task_count: pTasks.length,
          member_count: (members ?? []).filter((m: any) => m.project_id === p.id).length,
          completion_rate: pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0,
        };
      });
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async (): Promise<Project | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) return null;
      return data as any;
    },
  });
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Task[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, meetings(title)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, meeting_title: t.meetings?.title ?? "" }));
    },
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-members", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;

      const userIds = (data ?? []).map((m: any) => m.user_id).filter(Boolean);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("*").in("id", userIds)
        : { data: [] };

      return (data ?? []).map((m: any) => ({
        ...m,
        profile: (profiles ?? []).find((p: any) => p.id === m.user_id),
      }));
    },
  });
}

export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-documents", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectDocument[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectMeetings(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-meetings", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Meeting[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, general_summary: m.general_summary ?? "" }));
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: { name: string; description?: string; color?: string; status?: string; icon?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from("projects").insert({
        name: project.name,
        description: project.description ?? "",
        color: project.color ?? "#3B82F6",
        icon: project.icon ?? null,
        status: (project.status ?? "active") as any,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      // Add creator as owner
      await supabase.from("project_members").insert({
        project_id: (data as any).id,
        user_id: user.id,
        role: "owner" as any,
      });
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; status?: string; color?: string; icon?: string | null }) => {
      const { error } = await supabase.from("projects").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, role }: { projectId: string; userId: string; role?: string }) => {
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: userId,
        role: (role ?? "member") as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-members"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-members"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

export function useCreateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      projectId: string;
      description: string;
      assignee_name: string;
      assignee_user_id?: string;
      due_date?: string;
      priority?: string;
      status?: string;
      source?: string;
      meeting_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        project_id: task.projectId,
        meeting_id: task.meeting_id ?? null,
        description: task.description,
        assignee_name: task.assignee_name,
        assignee_user_id: task.assignee_user_id,
        due_date: task.due_date,
        priority: (task.priority ?? "MEDIUM") as any,
        status: (task.status ?? "OPEN") as any,
        source: (task.source ?? "manual") as any,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUploadProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const filePath = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("project-documents").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { error } = await supabase.from("project_documents").insert({
        project_id: projectId,
        name: file.name,
        file_path: filePath,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-documents"] }); },
  });
}

export function useDeleteProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from("project-documents").remove([filePath]);
      const { error } = await supabase.from("project_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-documents"] }); },
  });
}

export function useProjectStatusLog(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-status-log", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return [];
      const { data: taskIds } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId);
      if (!taskIds?.length) return [];
      const ids = taskIds.map(t => t.id);
      const { data, error } = await supabase
        .from("task_status_log")
        .select("*, tasks(description)")
        .in("task_id", ids)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        task_description: d.tasks?.description ?? "",
      }));
    },
  });
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface CalendarWindowData {
  events: any[];
  meetings: any[];
  tasks: any[];
}

export function useCalendarData(windowStart: Date, windowEnd: Date) {
  return useQuery({
    queryKey: ["calendar-data", windowStart.toISOString().slice(0, 10), windowEnd.toISOString().slice(0, 10)],
    queryFn: async (): Promise<CalendarWindowData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { events: [], meetings: [], tasks: [] };

      const startISO = windowStart.toISOString();
      const endISO = windowEnd.toISOString();
      const startDate = windowStart.toISOString().slice(0, 10);
      const endDate = windowEnd.toISOString().slice(0, 10);

      const [eventsRes, meetingsRes, tasksRes] = await Promise.all([
        supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_time", startISO)
          .lte("start_time", endISO)
          .order("start_time", { ascending: true }),

        supabase
          .from("meetings")
          .select("id, title, date, project_id, meeting_participants(name)")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false }),

        supabase
          .from("tasks")
          .select("id, description, due_date, status, assignee_name, assignee_user_id, project_id, priority")
          .eq("assignee_user_id", user.id)
          .not("due_date", "is", null)
          .gte("due_date", startDate)
          .lte("due_date", endDate),
      ]);

      return {
        events: eventsRes.data ?? [],
        meetings: meetingsRes.data ?? [],
        tasks: tasksRes.data ?? [],
      };
    },
  });
}
