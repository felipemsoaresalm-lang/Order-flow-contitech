import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assignExistingCode, markSapInserted, sendToEngineering } from "@/lib/workflow";
import { daysSince, formatCurrency, formatDate, type ItemStatus, type OrderStatus } from "@/lib/domain";
import { AgingBadge, ItemStatusBadge, OrderStatusBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/customer-service")({
  head: () => ({
    meta: [
      { title: "Fila do Customer Service | Pré-Entrada de Pedidos" },
      { name: "description", content: "Pedidos pendentes de ação: revisar, inserir no SAP e gerar a confirmação de pedido." },
      { property: "og:title", content: "Fila do Customer Service" },
      { property: "og:description", content: "Revisar pedidos, inserir no SAP e emitir confirmações." },
    ],
  }),
  component: CustomerServiceQueue,
});

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  sap_number: string | null;
  sap_inserted: boolean;
  order_items: {
    id: string;
    description: string;
    product_code: string | null;
    status: ItemStatus;
    status_changed_at: string;
    total_price: number | null;
  }[];
};

function CustomerServiceQueue() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [sap, setSap] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("stale_days").maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cs-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, status, created_at, sap_number, sap_inserted, order_items(id, description, product_code, status, status_changed_at, total_price)",
        )
        .neq("status", "cancelado")
        .order("created_at", { ascending: true });
      return (data ?? []) as unknown as Order[];
    },
  });

  const { data: engPending } = useQuery({
    queryKey: ["cs-eng-pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineering_requests")
        .select("order_item_id")
        .eq("status", "pendente");
      return new Set((data ?? []).map((r) => r.order_item_id));
    },
  });

  if (!hasRole("customer_service", "admin")) {
    return <p className="text-sm text-muted-foreground">Seu perfil não tem acesso a esta fila.</p>;
  }

  const orders = (data ?? []).filter((o) => o.status !== "confirmado" || !o.sap_inserted);
  const readyToConfirm = (data ?? []).filter(
    (o) => o.order_items.length > 0 && o.order_items.every((i) => i.status === "confirmado"),
  );
  const staleDays = settings?.stale_days ?? 3;

  const refresh = () => void queryClient.invalidateQueries();

  const saveCode = async (order: Order, itemId: string) => {
    const code = (codes[itemId] ?? "").trim();
    if (!code) {
      toast.error("Informe o código do produto.");
      return;
    }
    if (!user) return;
    setBusy(itemId);
    try {
      await assignExistingCode({
        itemId,
        orderId: order.id,
        orderNumber: order.order_number,
        productCode: code,
        userId: user.id,
      });
      toast.success("Código informado. Data solicitada ao Planejamento.");
      refresh();
    } catch (error) {
      toast.error("Não foi possível salvar o código", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const toEngineering = async (order: Order, itemId: string) => {
    if (!user) return;
    setBusy(itemId);
    try {
      await sendToEngineering({
        itemId,
        orderId: order.id,
        orderNumber: order.order_number,
        userId: user.id,
      });
      toast.success("Item enviado para a Engenharia.");
      refresh();
    } catch (error) {
      toast.error("Não foi possível enviar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const saveSap = async (order: Order) => {
    try {
      await markSapInserted(order.id, sap[order.id] ?? "");
      toast.success("Pedido marcado como inserido no SAP.");
      void queryClient.invalidateQueries({ queryKey: ["cs-queue"] });
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Fila do Customer Service</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} pedido(s) em andamento · {readyToConfirm.length} pronto(s) para confirmação.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && orders.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-panel">
          Nenhum pedido pendente de ação.
        </p>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const allConfirmed =
            order.order_items.length > 0 && order.order_items.every((i) => i.status === "confirmado");
          const total = order.order_items.reduce((a, i) => a + Number(i.total_price ?? 0), 0);

          return (
            <div key={order.id} className="rounded-lg border bg-card shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <Link to="/pedidos/$id" params={{ id: order.id }} className="font-medium text-primary hover:underline">
                    {order.order_number}
                  </Link>
                  <p className="text-sm">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Criado em {formatDate(order.created_at)} · {order.order_items.length} item(ns) ·{" "}
                    {formatCurrency(total)}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} sapInserted={order.sap_inserted} />
              </div>

              <ul className="divide-y">
                {order.order_items.map((item) => {
                  const needsCode = item.status === "aguardando_codigo";
                  const atEngineering = engPending?.has(item.id) ?? false;
                  return (
                    <li key={item.id} className="space-y-2 px-4 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {item.product_code ? `${item.product_code} — ` : ""}
                          {item.description}
                        </span>
                        <span className="flex items-center gap-2">
                          <ItemStatusBadge status={item.status} />
                          {atEngineering && (
                            <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
                              Na Engenharia
                            </span>
                          )}
                          {item.status !== "confirmado" && (
                            <AgingBadge days={daysSince(item.status_changed_at)} limit={staleDays} />
                          )}
                        </span>
                      </div>

                      {needsCode && !atEngineering && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            placeholder="Código existente do produto"
                            className="max-w-56 bg-background"
                            aria-label={`Código do item ${item.id}`}
                            value={codes[item.id] ?? ""}
                            onChange={(e) => setCodes((p) => ({ ...p, [item.id]: e.target.value }))}
                          />
                          <Button size="sm" disabled={busy === item.id} onClick={() => saveCode(order, item.id)}>
                            Salvar código
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === item.id}
                            onClick={() => toEngineering(order, item.id)}
                          >
                            Não existe — enviar à Engenharia
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-end gap-3 border-t bg-muted/40 px-4 py-3">
                {!order.sap_inserted ? (
                  <>
                    <Input
                      placeholder="Nº do pedido no SAP"
                      className="max-w-56 bg-background"
                      value={sap[order.id] ?? ""}
                      onChange={(e) => setSap((p) => ({ ...p, [order.id]: e.target.value }))}
                    />
                    <Button variant="secondary" onClick={() => saveSap(order)}>
                      Marcar como inserido no SAP
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Inserido no SAP{order.sap_number ? ` (${order.sap_number})` : ""}.
                  </p>
                )}

                <Button asChild disabled={!allConfirmed} className="ml-auto">
                  <Link to="/pedidos/$id/confirmacao" params={{ id: order.id }}>
                    <FileText className="mr-1 size-4" />
                    {allConfirmed ? "Gerar confirmação" : "Aguardando itens"}
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
