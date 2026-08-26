import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { respondPlanning } from "@/lib/workflow";
import { daysSince, formatDate, formatDateTime } from "@/lib/domain";
import { AgingBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Fila do Planejamento | Pré-Entrada de Pedidos" },
      { name: "description", content: "Solicitações de data de entrega pendentes por item de pedido." },
      { property: "og:title", content: "Fila do Planejamento" },
      { property: "og:description", content: "Informe a data de entrega dos itens pendentes." },
    ],
  }),
  component: PlanningQueue,
});

type Req = {
  id: string;
  requested_at: string;
  order_item: {
    id: string;
    description: string;
    product_code: string | null;
    quantity: number;
    lead_time: number | null;
    requested_delivery_date: string | null;
    order: { id: string; order_number: string; customer_name: string };
  };
};

function PlanningQueue() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("stale_days").maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["plan-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planning_requests")
        .select(
          "id, requested_at, order_item:order_items(id, description, product_code, quantity, lead_time, requested_delivery_date, order:orders(id, order_number, customer_name))",
        )
        .eq("status", "pendente")
        .order("requested_at", { ascending: true });
      return (data ?? []) as unknown as Req[];
    },
  });

  if (!hasRole("planejamento", "admin")) {
    return <p className="text-sm text-muted-foreground">Seu perfil não tem acesso a esta fila.</p>;
  }

  const submit = async (req: Req) => {
    const date = dates[req.id];
    if (!date) {
      toast.error("Informe a data de entrega.");
      return;
    }
    if (!user) return;
    setBusy(req.id);
    try {
      await respondPlanning({
        requestId: req.id,
        itemId: req.order_item.id,
        orderId: req.order_item.order.id,
        orderNumber: req.order_item.order.order_number,
        deliveryDate: date,
        userId: user.id,
      });
      toast.success("Data informada. Item confirmado.");
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
        <h1 className="page-title">Fila do Planejamento</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} item(ns) aguardando data de entrega.
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
                <p className="text-sm">
                  {req.order_item.product_code ? `${req.order_item.product_code} — ` : ""}
                  {req.order_item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.order_item.order.customer_name} · {req.order_item.quantity} un ·{" "}
                  {req.order_item.lead_time ? `LT ${req.order_item.lead_time} dias · ` : ""}
                  data desejada {formatDate(req.order_item.requested_delivery_date)} · solicitado em{" "}
                  {formatDateTime(req.requested_at)}
                </p>
              </div>
              <AgingBadge days={daysSince(req.requested_at)} limit={staleDays} />
            </div>
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1.5">
                <Label>Data de entrega</Label>
                <Input
                  type="date"
                  value={dates[req.id] ?? ""}
                  onChange={(e) => setDates((p) => ({ ...p, [req.id]: e.target.value }))}
                />
              </div>
              <Button onClick={() => submit(req)} disabled={busy === req.id}>
                {busy === req.id ? "Enviando..." : "Confirmar data"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
