import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Meeting, Task, Import, Tag, KPIData, TaskStatus, TaskStatusLog, TaskDependency } from "@/types";

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: async (): Promise<Meeting[]> => {
      const { data: meetings, error } = await supabase
        .from("meetings")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;

      const ids = meetings.map((m) => m.id);
      if (ids.length === 0) return [];

      const [{ data: topics }, { data: participants }, { data: meetingTags }, { data: tags }] = await Promise.all([
        supabase.from("meeting_topics").select("*").in("meeting_id", ids),
        supabase.from("meeting_participants").select("*").in("meeting_id", ids),
        supabase.from("meeting_tags").select("*").in("meeting_id", ids),
        supabase.from("tags").select("*"),
      ]);

      const tagsMap = new Map((tags ?? []).map((t) => [t.id, t]));

      return meetings.map((m) => ({
        ...m,
        general_summary: m.general_summary ?? "",
        topics: (topics ?? [])
          .filter((t) => t.meeting_id === m.id)
          .map((t) => ({ ...t, notes: (t.notes as string[]) ?? [] })),
        participants: (participants ?? []).filter((p) => p.meeting_id === m.id),
        tags: (meetingTags ?? [])
          .filter((mt) => mt.meeting_id === m.id)
          .map((mt) => tagsMap.get(mt.tag_id))
          .filter(Boolean) as Tag[],
      }));
    },
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ["meeting", id],
    enabled: !!id,
    queryFn: async (): Promise<Meeting | null> => {
      if (!id) return null;
      const { data: m, error } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (error) return null;

      const [{ data: topics }, { data: participants }, { data: meetingTags }, { data: tags }] = await Promise.all([
        supabase.from("meeting_topics").select("*").eq("meeting_id", id),
        supabase.from("meeting_participants").select("*").eq("meeting_id", id),
        supabase.from("meeting_tags").select("*").eq("meeting_id", id),
        supabase.from("tags").select("*"),
      ]);

      const tagsMap = new Map((tags ?? []).map((t) => [t.id, t]));

      return {
        ...m,
        general_summary: m.general_summary ?? "",
        topics: (topics ?? []).map((t) => ({ ...t, notes: (t.notes as string[]) ?? [] })),
        participants: participants ?? [],
        tags: (meetingTags ?? [])
          .map((mt) => tagsMap.get(mt.tag_id))
          .filter(Boolean) as Tag[],
      };
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, meetings(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        meeting_title: t.meetings?.title ?? "",
      }));
    },
  });
}

export function useTasksForMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "meeting", meetingId],
    enabled: !!meetingId,
    queryFn: async (): Promise<Task[]> => {
      if (!meetingId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: async (): Promise<Import[]> => {
      // Fetch imports joined with their meeting to get project_id
      const { data, error } = await supabase
        .from("imports")
        .select("*, meetings(id, project_id, projects(id, name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((imp: any) => {
        const meeting = Array.isArray(imp.meetings) ? imp.meetings[0] : imp.meetings;
        const project = meeting?.projects;
        return {
          ...imp,
          meetings: undefined,
          meeting_id: meeting?.id ?? null,
          project_id: project?.id ?? null,
          project_name: project?.name ?? null,
        };
      });
    },
  });
}

export function useKPIs() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: async (): Promise<KPIData> => {
      const [{ count: totalMeetings }, { data: taskData }] = await Promise.all([
        supabase.from("meetings").select("*", { count: "exact", head: true }),
        // Only count tasks that belong to a project
        supabase.from("tasks").select("status, due_date, project_id").not("project_id", "is", null),
      ]);

      const tasks = taskData ?? [];
      const openTasks = tasks.filter((t) => t.status !== "COMPLETED").length;
      const now = new Date().toISOString();
      const overdueTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.due_date && t.due_date < now).length;
      const completed = tasks.filter((t) => t.status === "COMPLETED").length;
      const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

      return { totalMeetings: totalMeetings ?? 0, openTasks, overdueTasks, completionRate };
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" }));
    },
  });
}

export function useStatusLog() {
  return useQuery({
    queryKey: ["status-log"],
    queryFn: async (): Promise<TaskStatusLog[]> => {
      const { data, error } = await supabase
        .from("task_status_log")
        .select("*, tasks(description)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        old_status: d.old_status as TaskStatus | null,
        new_status: d.new_status as TaskStatus,
        task_description: d.tasks?.description ?? "",
      }));
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      oldStatus,
      newStatus,
      changedBy,
      changedByName,
      note,
    }: {
      taskId: string;
      oldStatus: TaskStatus;
      newStatus: TaskStatus;
      changedBy: string;
      changedByName: string;
      note?: string;
    }) => {
      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);
      if (updateErr) throw updateErr;

      const { error: logErr } = await supabase
        .from("task_status_log")
        .insert({
          task_id: taskId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: changedBy,
          changed_by_name: changedByName,
          note: note ?? null,
        });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["status-log"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

export function useTaskDependencies() {
  return useQuery({
    queryKey: ["task-dependencies"],
    queryFn: async (): Promise<TaskDependency[]> => {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*, tasks!task_dependencies_depends_on_task_id_fkey(id, description, status)");
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        depends_on_task: d.tasks ?? undefined,
      }));
    },
  });
}

export function useAddTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, dependsOnTaskId }: { taskId: string; dependsOnTaskId: string }) => {
      const { error } = await supabase
        .from("task_dependencies")
        .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] });
    },
  });
}

export function useRemoveTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] });
    },
  });
}

export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string | null }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: dueDate })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

export function useUpdateTaskPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, priority }: { taskId: string; priority: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ priority: priority as any })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTaskDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, description, assignee_name, assignee_user_id, tags }: { taskId: string; description?: string; assignee_name?: string; assignee_user_id?: string; tags?: string[] }) => {
      const updates: Record<string, any> = {};
      if (description !== undefined) updates.description = description;
      if (assignee_name !== undefined) updates.assignee_name = assignee_name;
      if (assignee_user_id !== undefined) updates.assignee_user_id = assignee_user_id;
      if (tags !== undefined) updates.tags = tags;
      if (Object.keys(updates).length === 0) return;
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "user" }) => {
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();
      if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await supabase.functions.invoke("invite-user", {
        body: { email, fullName },
      });
      if (res.error) throw new Error(res.error.message ?? "Invite failed");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.user as { id: string; email: string } | undefined;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useAssignMeetingProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, projectId }: { meetingId: string; projectId: string }) => {
      const { error: meetingErr } = await supabase
        .from("meetings")
        .update({ project_id: projectId })
        .eq("id", meetingId);
      if (meetingErr) throw meetingErr;

      const { error: tasksErr } = await supabase
        .from("tasks")
        .update({ project_id: projectId })
        .eq("meeting_id", meetingId);
      if (tasksErr) throw tasksErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateParticipantUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId, userId }: { participantId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("meeting_participants")
        .update({ user_id: userId })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useDeleteTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      // Delete dependencies first
      await supabase.from("task_dependencies").delete().in("task_id", taskIds);
      await supabase.from("task_dependencies").delete().in("depends_on_task_id", taskIds);
      await supabase.from("task_status_log").delete().in("task_id", taskIds);
      const { error } = await supabase.from("tasks").delete().in("id", taskIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
    },
  });
}

export function useUnassignedMeetingsCount() {
  return useQuery({
    queryKey: ["meetings", "unassigned-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("meetings")
        .select("*", { count: "exact", head: true })
        .is("project_id", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllProjectMembers() {
  return useQuery({
    queryKey: ["all-project-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, project_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_members")
        .insert({ user_id: userId, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-project-members"] });
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("user_id", userId)
        .eq("project_id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-project-members"] });
    },
  });
}



export function useIsProjectMember(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-membership", projectId],
    queryFn: async () => {
      if (!projectId) return false;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
