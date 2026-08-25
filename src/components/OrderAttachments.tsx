import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ATTACHMENTS_BUCKET, deleteOrderAttachment, uploadOrderAttachments } from "@/lib/workflow";
import { formatDateTime } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

const sizeLabel = (bytes: number | null) => {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

export function OrderAttachments({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: attachments } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_attachments")
        .select("id, file_name, file_path, size_bytes, uploaded_by, created_at")
        .eq("order_id", orderId)
        .order("created_at");
      return (data ?? []) as Attachment[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["order-attachments", orderId] });

  const onSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user) return;
    setBusy(true);
    try {
      await uploadOrderAttachments(orderId, Array.from(fileList), user.id);
      toast.success("Anexos enviados");
      refresh();
    } catch (error) {
      toast.error("Não foi possível enviar os anexos", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(a.file_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (a: Attachment) => {
    try {
      await deleteOrderAttachment(a.id, a.file_path);
      refresh();
    } catch {
      toast.error("Não foi possível remover o anexo");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <Paperclip className="size-4 text-muted-foreground" />
        <p className="font-medium">Anexos do pedido</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="novos-anexos" className="text-xs text-muted-foreground">
          Selecione um ou vários arquivos
        </Label>
        <Input
          id="novos-anexos"
          type="file"
          multiple
          disabled={busy}
          className="cursor-pointer"
          onChange={(e) => {
            void onSelect(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="mt-3 divide-y">
        {(attachments ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{a.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.created_at)} {sizeLabel(a.size_bytes) && `· ${sizeLabel(a.size_bytes)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`Baixar ${a.file_name}`} onClick={() => void download(a)}>
                <Download className="size-4" />
              </Button>
              {a.uploaded_by === user?.id && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${a.file_name}`} onClick={() => void remove(a)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          </li>
        ))}
        {(attachments ?? []).length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Nenhum anexo enviado.</li>
        )}
      </ul>
    </div>
  );
}
