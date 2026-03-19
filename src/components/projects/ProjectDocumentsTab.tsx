import { useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, Download } from "lucide-react";
import { useProjectDocuments, useUploadProjectDocument, useDeleteProjectDocument } from "@/hooks/useProjectData";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props { projectId: string; canEdit?: boolean; }

export function ProjectDocumentsTab({ projectId, canEdit = false }: Props) {
  const { data: docs, isLoading } = useProjectDocuments(projectId);
  const upload = useUploadProjectDocument();
  const deletDoc = useDeleteProjectDocument();

  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ projectId, file });
      toast({ title: t.projectDetail.fileUploaded });
    } catch (err: any) {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (filePath: string, name: string) => {
    const { data } = await supabase.storage.from("project-documents").createSignedUrl(filePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(docs ?? []).length} {t.projectDetail.filesCount}</p>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4 mr-1" /> {upload.isPending ? "…" : t.projectDetail.uploadFile}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{t.projectDetail.fileName}</TableHead>
              <TableHead>{t.projectDetail.uploaded}</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(docs ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t.projectDetail.noFiles}</TableCell></TableRow>
            ) : (
              (docs ?? []).map(doc => (
                <TableRow key={doc.id} className="hover:bg-muted/20">
                  <TableCell className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{doc.name}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(parseISO(doc.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc.file_path, doc.name)}><Download className="h-3 w-3" /></Button>
                      {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletDoc.mutate({ id: doc.id, filePath: doc.file_path })}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
