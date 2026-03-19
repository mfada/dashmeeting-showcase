import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, CalendarIcon, DollarSign, Layers } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import {
  useBudgetPhases,
  useBudgetItems,
  useCreateBudgetPhase,
  useDeleteBudgetPhase,
  useCreateBudgetItem,
  useDeleteBudgetItem,
  type BudgetPhase,
  type BudgetItem,
} from "@/hooks/useBudgetData";

interface Props {
  projectId: string;
}

export function ProjectBudgetTab({ projectId }: Props) {
  const { data: phases, isLoading: phasesLoading } = useBudgetPhases(projectId);
  const { data: items, isLoading: itemsLoading } = useBudgetItems(projectId);
  const { t } = useLanguage();

  const allPhases = phases ?? [];
  const allItems = items ?? [];

  const totalPlanned = allItems.reduce((s, i) => s + Number(i.planned_amount), 0);
  const totalActual = allItems.reduce((s, i) => s + Number(i.actual_amount), 0);
  const spentPercent = totalPlanned > 0 ? Math.min(Math.round((totalActual / totalPlanned) * 100), 100) : 0;

  if (phasesLoading || itemsLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6 pt-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">{t.budget.totalPlanned}</p>
            <p className="text-2xl font-bold mt-1">${totalPlanned.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">{t.budget.totalSpent}</p>
            <p className="text-2xl font-bold mt-1">${totalActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium">{t.budget.budgetUsed}</p>
            <div className="flex items-center gap-3 mt-2">
              <Progress value={spentPercent} className="flex-1 h-2" />
              <span className="text-sm font-semibold">{spentPercent}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Phase */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Layers className="h-4 w-4" /> {t.budget.phases}
        </h2>
        <AddPhaseDialog projectId={projectId} phaseCount={allPhases.length} />
      </div>

      {/* Phases */}
      {allPhases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.budget.noPhases}
          </CardContent>
        </Card>
      ) : (
        allPhases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} items={allItems.filter((i) => i.phase_id === phase.id)} projectId={projectId} />
        ))
      )}
    </div>
  );
}

function PhaseCard({ phase, items, projectId }: { phase: BudgetPhase; items: BudgetItem[]; projectId: string }) {
  const deletePhase = useDeleteBudgetPhase();
  const deleteItem = useDeleteBudgetItem();
  const { t } = useLanguage();

  const planned = items.reduce((s, i) => s + Number(i.planned_amount), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual_amount), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{phase.name}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              ${actual.toLocaleString("en-US", { minimumFractionDigits: 2 })} / ${planned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <AddItemDialog projectId={projectId} phaseId={phase.id} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => deletePhase.mutate({ id: phase.id, projectId }, {
                onSuccess: () => toast({ title: t.budget.phaseDeleted }),
                onError: (e) => toast({ title: t.common.error, description: String(e), variant: "destructive" }),
              })}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{t.budget.noItems}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t.budget.category}</TableHead>
                <TableHead className="text-xs">{t.budget.description}</TableHead>
                <TableHead className="text-xs text-right">{t.budget.planned}</TableHead>
                <TableHead className="text-xs text-right">{t.budget.actual}</TableHead>
                <TableHead className="text-xs">{t.budget.date}</TableHead>
                <TableHead className="text-xs">{t.budget.status}</TableHead>
                <TableHead className="text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium">{item.category}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{item.description}</TableCell>
                  <TableCell className="text-xs text-right">${Number(item.planned_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs text-right">${Number(item.actual_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.item_date ? format(parseISO(item.item_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", item.status === "paid" ? "text-success border-success/20" : "text-warning border-warning/20")}>
                      {item.status === "paid" ? t.budget.paid : t.budget.pending}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteItem.mutate({ id: item.id, projectId }, {
                        onError: (e) => toast({ title: t.common.error, description: String(e), variant: "destructive" }),
                      })}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AddPhaseDialog({ projectId, phaseCount }: { projectId: string; phaseCount: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useCreateBudgetPhase();
  const { t } = useLanguage();

  const handleCreate = () => {
    if (!name.trim()) return;
    create.mutate(
      { projectId, name: name.trim(), sortOrder: phaseCount },
      {
        onSuccess: () => { toast({ title: t.budget.phaseCreated }); setName(""); setOpen(false); },
        onError: (e) => toast({ title: t.common.error, description: String(e), variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> {t.budget.addPhase}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{t.budget.addPhase}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t.budget.phaseName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" placeholder="e.g. Planning, Execution..." />
          </div>
          <Button className="w-full" size="sm" onClick={handleCreate} disabled={!name.trim() || create.isPending}>
            {t.budget.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ projectId, phaseId }: { projectId: string; phaseId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [status, setStatus] = useState("pending");
  const create = useCreateBudgetItem();
  const { t } = useLanguage();

  const reset = () => { setCategory(""); setDescription(""); setPlanned(""); setActual(""); setDate(undefined); setStatus("pending"); };

  const handleCreate = () => {
    if (!category.trim()) return;
    create.mutate(
      {
        phase_id: phaseId,
        project_id: projectId,
        category: category.trim(),
        description: description.trim(),
        planned_amount: parseFloat(planned) || 0,
        actual_amount: parseFloat(actual) || 0,
        item_date: date ? format(date, "yyyy-MM-dd") : null,
        status,
      },
      {
        onSuccess: () => { toast({ title: t.budget.itemCreated }); reset(); setOpen(false); },
        onError: (e) => toast({ title: t.common.error, description: String(e), variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t.budget.addItem}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t.budget.category}</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-sm" placeholder="e.g. Marketing, Engineering..." />
          </div>
          <div>
            <Label className="text-xs">{t.budget.description}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.budget.planned} (USD)</Label>
              <Input type="number" value={planned} onChange={(e) => setPlanned(e.target.value)} className="h-8 text-sm" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">{t.budget.actual} (USD)</Label>
              <Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} className="h-8 text-sm" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t.budget.date}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-8 justify-start text-xs font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {date ? format(date, "MMM d, yyyy") : t.budget.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">{t.budget.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t.budget.pending}</SelectItem>
                  <SelectItem value="paid">{t.budget.paid}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" size="sm" onClick={handleCreate} disabled={!category.trim() || create.isPending}>
            {t.budget.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
