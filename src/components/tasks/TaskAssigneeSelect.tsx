import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Check } from "lucide-react";
import { useProfiles, useUpdateTaskDetails, useCreateProfile } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import type { Task } from "@/types";

interface TaskAssigneeSelectProps {
  task: Task;
  disabled?: boolean;
}

export default function TaskAssigneeSelect({ task, disabled }: TaskAssigneeSelectProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  const { data: profiles } = useProfiles();
  const updateTask = useUpdateTaskDetails();
  const createProfile = useCreateProfile();
  const { t } = useLanguage();

  const allProfiles = profiles ?? [];
  const filtered = allProfiles.filter(
    (p) =>
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (profileId: string, name: string) => {
    updateTask.mutate(
      { taskId: task.id, assignee_name: name, assignee_user_id: profileId },
      {
        onSuccess: () => {
          toast({ title: t.tasks.assigneeUpdated });
          setPopoverOpen(false);
        },
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const handleCreateUser = () => {
    if (!firstName.trim() || !email.trim()) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    createProfile.mutate(
      { email: email.trim(), fullName },
      {
        onSuccess: (createdUser) => {
          toast({ title: t.users.userCreated });
          setDialogOpen(false);
          setFirstName("");
          setLastName("");
          setEmail("");
          setRole("user");
          // Auto-assign the newly created user to this task
          if (createdUser?.id) {
            updateTask.mutate(
              { taskId: task.id, assignee_name: fullName, assignee_user_id: createdUser.id },
              {
                onSuccess: () => toast({ title: t.tasks.assigneeUpdated }),
                onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
              }
            );
          }
        },
        onError: (err) => toast({ title: t.common.error, description: String(err), variant: "destructive" }),
      }
    );
  };

  const assigneeProfile = allProfiles.find((p) => p.id === task.assignee_user_id);
  const assigneeInitials = (task.assignee_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left truncate max-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed" disabled={disabled}>
            <Avatar className="h-5 w-5 shrink-0">
              {assigneeProfile?.avatar_url && <AvatarImage src={assigneeProfile.avatar_url} alt={task.assignee_name ?? ""} />}
              <AvatarFallback className="bg-primary/20 text-primary text-[8px] font-medium">{assigneeInitials}</AvatarFallback>
            </Avatar>
            <span className="truncate">{task.assignee_name || t.tasks.assignee}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t.tasks.searchUsers}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.slice(0, 20).map((p) => {
              const initials = (p.full_name ?? p.email ?? "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 transition-colors text-left"
                  onClick={() => handleSelect(p.id, p.full_name ?? p.email ?? "")}
                >
                  {task.assignee_user_id === p.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                  <Avatar className="h-5 w-5 shrink-0">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? ""} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-[8px] font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{p.full_name ?? p.email}</span>
                  <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">{p.email}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">{t.tasks.noUsersFound}</p>
            )}
          </div>
          <div className="border-t mt-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs gap-1.5"
              onClick={() => { setPopoverOpen(false); setDialogOpen(true); }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t.tasks.createNewUser}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t.tasks.createNewUser}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.tasks.firstName}</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">{t.tasks.lastName}</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t.users.email}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">{t.users.role}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t.users.user}</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground">{t.users.createHint}</p>
            <Button
              className="w-full"
              size="sm"
              onClick={handleCreateUser}
              disabled={createProfile.isPending || !firstName.trim() || !email.trim()}
            >
              {createProfile.isPending ? t.users.creating : t.users.createUser}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
