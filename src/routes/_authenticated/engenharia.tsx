import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { respondEngineering } from "@/lib/workflow";
import { daysSince, formatDate, formatDateTime } from "@/lib/domain";
import { AgingBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/_authenticated/engenharia")({
  head: () => ({
    meta: [
      { title: "Fila da Engenharia | Pré-Entrada de Pedidos" },
      { name: "description", content: "Solicitações de criação de código de produto pendentes, com lead time e roteiro." },
      { property: "og:title", content: "Fila da Engenharia" },
      { property: "og:description", content: "Responda solicitações de código com lead time e roteiro." },
    ],
  }),
  component: EngineeringQueue,
});

type Req = {
  id: string;
  order_item_id: string;
  requested_at: string;
  order_item: {
    id: string;
    description: string;
    quantity: number;
    requested_delivery_date: string | null;
    order: { id: string; order_number: string; customer_name: string };
  };
};

function EngineeringQueue() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, { code: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("stale_days").maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["eng-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineering_requests")
        .select(
          "id, order_item_id, requested_at, order_item:order_items(id, description, quantity, requested_delivery_date, order:orders(id, order_number, customer_name))",
        )
        .eq("status", "pendente")
        .order("requested_at", { ascending: true });
      return (data ?? []) as unknown as Req[];
    },
  });

  if (!hasRole("engenharia", "admin")) {
    return <p className="text-sm text-muted-foreground">Seu perfil não tem acesso a esta fila.</p>;
  }

  const submit = async (req: Req) => {
    const values = form[req.id];
    if (!values?.code?.trim()) {
      toast.error("Informe o código do produto.");
      return;
    }
    if (!user) return;
    setBusy(req.id);
    try {
      await respondEngineering({
        requestId: req.id,
        itemId: req.order_item.id,
        orderId: req.order_item.order.id,
        orderNumber: req.order_item.order.order_number,
        productCode: values.code.trim(),
        userId: user.id,
      });
      toast.success("Código enviado. Data solicitada ao Planejamento.");
      void queryClient.invalidateQueries();
    } catch (error) {
      toast.error("Não foi possível responder", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const rows = data ?? [];
  const staleDays = settings?.stale_days ?? 3;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Fila da Engenharia</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} solicitação(ões) de código pendente(s), das mais antigas para as mais novas.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && rows.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-panel">
          Nenhuma solicitação pendente.
        </p>
      )}

      <div className="space-y-4">
        {rows.map((req) => (
          <div key={req.id} className="rounded-lg border bg-card shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
              <div>
                <Link
                  to="/pedidos/$id"
                  params={{ id: req.order_item.order.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {req.order_item.order.order_number}
                </Link>
                <p className="text-sm">{req.order_item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {req.order_item.order.customer_name} · {req.order_item.quantity} un · data desejada{" "}
                  {formatDate(req.order_item.requested_delivery_date)} · solicitado em{" "}
                  {formatDateTime(req.requested_at)}
                </p>
              </div>
              <AgingBadge days={daysSince(req.requested_at)} limit={staleDays} />
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-12">
              <div className="space-y-1.5 md:col-span-8">
                <Label>Código do produto</Label>
                <Input
                  value={form[req.id]?.code ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [req.id]: { code: e.target.value } }))}
                />
              </div>
              <div className="flex items-end md:col-span-4">
                <Button className="w-full" onClick={() => submit(req)} disabled={busy === req.id}>
                  {busy === req.id ? "Enviando..." : "Responder"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
