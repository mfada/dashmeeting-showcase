import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetPhase {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface BudgetItem {
  id: string;
  phase_id: string;
  project_id: string;
  category: string;
  description: string;
  planned_amount: number;
  actual_amount: number;
  item_date: string | null;
  status: string;
  created_at: string;
}

export function useBudgetPhases(projectId: string) {
  return useQuery({
    queryKey: ["budget-phases", projectId],
    queryFn: async (): Promise<BudgetPhase[]> => {
      const { data, error } = await supabase
        .from("budget_phases")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BudgetPhase[];
    },
  });
}

export function useBudgetItems(projectId: string) {
  return useQuery({
    queryKey: ["budget-items", projectId],
    queryFn: async (): Promise<BudgetItem[]> => {
      const { data, error } = await supabase
        .from("budget_items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as BudgetItem[];
    },
  });
}

export function useCreateBudgetPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, name, sortOrder }: { projectId: string; name: string; sortOrder: number }) => {
      const { error } = await supabase.from("budget_phases").insert({ project_id: projectId, name, sort_order: sortOrder } as any);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["budget-phases", v.projectId] }),
  });
}

export function useDeleteBudgetPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from("budget_phases").delete().eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["budget-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["budget-items", projectId] });
    },
  });
}

export function useCreateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { phase_id: string; project_id: string; category: string; description: string; planned_amount: number; actual_amount: number; item_date: string | null; status: string }) => {
      const { error } = await supabase.from("budget_items").insert(item as any);
      if (error) throw error;
      return item.project_id;
    },
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ["budget-items", projectId] }),
  });
}

export function useUpdateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...updates }: { id: string; projectId: string; [key: string]: any }) => {
      const { error } = await supabase.from("budget_items").update(updates as any).eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ["budget-items", projectId] }),
  });
}

export function useDeleteBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from("budget_items").delete().eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => qc.invalidateQueries({ queryKey: ["budget-items", projectId] }),
  });
}
