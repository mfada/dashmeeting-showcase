import { useStatusLog } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/i18n/LanguageContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, History } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useState } from "react";
import type { TaskStatus } from "@/types";

export default function StatusLog() {
  const { data: logs, isLoading } = useStatusLog();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t.statusLog.activityLog}</span>
          {logs && <span className="text-xs text-muted-foreground">({logs.length} {t.statusLog.recent})</span>}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t max-h-64 overflow-y-auto divide-y">
          {isLoading && <p className="text-sm text-muted-foreground p-4">{t.statusLog.loading}</p>}
          {logs && logs.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">{t.statusLog.noChanges}</p>}
          {logs?.map((log) => (
            <div key={log.id} className="px-4 py-2 flex items-center gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{log.changed_by_name}</span>
                <span className="text-muted-foreground"> {t.statusLog.moved} </span>
                <span className="font-medium truncate">&ldquo;{(log.task_description ?? "").slice(0, 50)}&rdquo;</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {log.old_status && <Badge variant="outline" className="text-[10px]">{t.statuses[log.old_status]}</Badge>}
                <span className="text-muted-foreground">→</span>
                <Badge variant="outline" className="text-[10px]">{t.statuses[log.new_status]}</Badge>
              </div>
              <span className="text-muted-foreground shrink-0">
                {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
