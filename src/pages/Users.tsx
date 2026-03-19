import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Shield, User, Trash2, FolderOpen, ChevronDown, Check } from "lucide-react";
import {
  useProfiles, useCreateProfile, useUpdateUserRole, useDeleteProfile,
  useProjects, useAllProjectMembers, useAddProjectMember, useRemoveProjectMember,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

/* ── Project assignment popover (per-user) ────────────────────── */
function ProjectAssignPopover({
  userId,
  memberProjectIds,
  allProjects,
}: {
  userId: string;
  memberProjectIds: string[];
  allProjects: { id: string; name: string }[];
}) {
  const addMember    = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const [open, setOpen] = useState(false);

  const toggle = (projectId: string, checked: boolean) => {
    if (checked) {
      addMember.mutate({ userId, projectId }, {
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    } else {
      removeMember.mutate({ userId, projectId }, {
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    }
  };

  const assigned = allProjects.filter(p => memberProjectIds.includes(p.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 group min-w-[120px]">
          <div className="flex flex-wrap gap-1">
            {assigned.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">None</span>
            ) : (
              assigned.map(p => (
                <Badge key={p.id} variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 font-normal border-primary/30 text-primary bg-primary/5">
                  {p.name}
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <p className="text-xs font-semibold text-muted-foreground px-2 pb-2 pt-1 uppercase tracking-wide">
          Assign to projects
        </p>
        <div className="space-y-0.5">
          {allProjects.map(project => {
            const isChecked = memberProjectIds.includes(project.id);
            const isBusy    = addMember.isPending || removeMember.isPending;
            return (
              <label key={project.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors">
                <Checkbox
                  checked={isChecked}
                  disabled={isBusy}
                  onCheckedChange={(val) => toggle(project.id, val === true)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-sm">{project.name}</span>
                {isChecked && <Check className="h-3 w-3 text-primary ml-auto" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function UsersPage() {
  const { data: profiles, isLoading }       = useProfiles();
  const { data: allProjects = [] }          = useProjects();
  const { data: allMembers  = [] }          = useAllProjectMembers();
  const { isAdmin }                         = useAuth();
  const { t }                               = useLanguage();
  const createProfile  = useCreateProfile();
  const updateRole     = useUpdateUserRole();
  const deleteProfile  = useDeleteProfile();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newEmail,   setNewEmail]   = useState("");

  // Build a map: userId → [projectId, ...]
  const memberMap: Record<string, string[]> = {};
  for (const m of allMembers) {
    if (!memberMap[m.user_id]) memberMap[m.user_id] = [];
    memberMap[m.user_id].push(m.project_id);
  }

  const handleInvite = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    createProfile.mutate(
      { email: newEmail.trim(), fullName: newName.trim() },
      {
        onSuccess: () => {
          toast({ title: t.users.userCreated });
          setDialogOpen(false);
          setNewName("");
          setNewEmail("");
        },
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleRoleChange = (userId: string, role: "admin" | "user") => {
    updateRole.mutate({ userId, role }, {
      onSuccess: () => toast({ title: t.users.roleUpdated }),
      onError:   (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
    });
  };

  const handleDelete = (userId: string, name: string) => {
    if (!confirm(t.users.deleteConfirm.replace("{name}", name))) return;
    deleteProfile.mutate(userId, {
      onSuccess: () => toast({ title: t.users.userDeleted }),
      onError:   (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.users.title}</h1>
          <p className="text-sm text-muted-foreground">
            {profiles?.length ?? 0} {t.users.usersCount}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-1" /> {t.users.addUser}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.users.addKnownUser}</DialogTitle>
                <DialogDescription>{t.users.createHint}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.users.fullName}</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>{t.users.email}</Label>
                  <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <Button onClick={handleInvite} disabled={createProfile.isPending} className="w-full">
                  {createProfile.isPending ? t.users.creating : t.users.createUser}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.users.user}</TableHead>
                  <TableHead>{t.users.email}</TableHead>
                  <TableHead>{t.users.role}</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      Projects
                    </div>
                  </TableHead>
                  <TableHead>{t.users.joined}</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    {/* Name */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {(p.full_name ?? "?").split(" ").map((n: string) => n[0]).join("")}
                          </span>
                        </div>
                        <span className="text-sm font-medium">{p.full_name ?? "Unknown"}</span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>

                    {/* Role */}
                    <TableCell>
                      {isAdmin ? (
                        <Select value={p.role} onValueChange={val => handleRoleChange(p.id, val as "admin" | "user")}>
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin" className="text-xs">admin</SelectItem>
                            <SelectItem value="user"  className="text-xs">user</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={p.role === "admin" ? "default" : "secondary"} className="text-[10px] gap-1">
                          {p.role === "admin" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {p.role}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Projects column */}
                    <TableCell>
                      {isAdmin ? (
                        <ProjectAssignPopover
                          userId={p.id}
                          memberProjectIds={memberMap[p.id] ?? []}
                          allProjects={allProjects as { id: string; name: string }[]}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(memberMap[p.id] ?? []).length === 0
                            ? <span className="text-xs text-muted-foreground italic">None</span>
                            : (allProjects as { id: string; name: string }[])
                                .filter(proj => (memberMap[p.id] ?? []).includes(proj.id))
                                .map(proj => (
                                  <Badge key={proj.id} variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                    {proj.name}
                                  </Badge>
                                ))
                          }
                        </div>
                      )}
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(p.created_at), "MMM d, yyyy")}
                    </TableCell>

                    {/* Delete */}
                    {isAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.full_name)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {(profiles ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                      {t.users.noUsers}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
