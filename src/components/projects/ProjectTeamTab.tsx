import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useProjectMembers, useAddProjectMember, useRemoveProjectMember } from "@/hooks/useProjectData";
import { useProfiles } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Props { projectId: string; canEdit?: boolean; }

export function ProjectTeamTab({ projectId, canEdit = false }: Props) {
  const { data: members, isLoading } = useProjectMembers(projectId);
  const { data: allProfiles } = useProfiles();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const memberIds = new Set((members ?? []).map(m => m.user_id));
  const available = (allProfiles ?? []).filter(p => !memberIds.has(p.id));

  const roleLabels: Record<string, string> = {
    owner: t.projectTeam.owner,
    member: t.projectTeam.member,
    viewer: t.projectTeam.viewer,
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    try {
      await addMember.mutateAsync({ projectId, userId: selectedUser, role: selectedRole });
      toast({ title: t.projectDetail.memberAdded });
      // Send notification email
      supabase.functions.invoke("send-task-notification", {
        body: { type: "team_added", userId: selectedUser, projectId },
      }).catch(() => {});
      setOpen(false);
      setSelectedUser("");
    } catch (e: any) {
      toast({ title: t.common.error, description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(members ?? []).length} {t.projectDetail.membersCount}</p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t.projectDetail.addMember}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.projectDetail.addMember}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger><SelectValue placeholder={t.projectDetail.selectUser} /></SelectTrigger>
                  <SelectContent>
                    {available.map(p => <SelectItem key={p.id} value={p.id}>{(p as any).full_name ?? p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t.projectTeam.owner}</SelectItem>
                    <SelectItem value="member">{t.projectTeam.member}</SelectItem>
                    <SelectItem value="viewer">{t.projectTeam.viewer}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAdd} disabled={addMember.isPending} className="w-full">{t.projectDetail.add}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{t.projectDetail.memberName}</TableHead>
              <TableHead>{t.projectDetail.role}</TableHead>
              {canEdit && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t.projectDetail.noMembers}</TableCell></TableRow>
            ) : (
              (members ?? []).map(m => (
                <TableRow key={m.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                        {(m.profile?.full_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.profile?.full_name ?? "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground">{m.profile?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{roleLabels[m.role] ?? m.role}</Badge></TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember.mutate(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
