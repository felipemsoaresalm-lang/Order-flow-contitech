import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ArrowLeft, ChevronDown, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  daysSince,
  durationLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  itemStatusLabels,
  type ItemStatus,
  type OrderStatus,
} from "@/lib/domain";
import { AgingBadge, ItemStatusBadge, OrderStatusBadge } from "@/components/StatusBadges";
import { OrderAttachments } from "@/components/OrderAttachments";
import { calcularImpostos, findCategoria } from "@/lib/tax";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do pedido | Pré-Entrada de Pedidos" },
      { name: "description", content: "Itens do pedido, linha do tempo por etapa e indicação de onde a pendência está parada." },
      { property: "og:title", content: "Detalhe do pedido | Pré-Entrada de Pedidos" },
      { property: "og:description", content: "Itens, linha do tempo e pendências do pedido." },
    ],
  }),
  component: OrderDetail,
});

type Item = {
  id: string;
  product_code: string | null;
  description: string;
  quantity: number;
  units_count: number;
  qty_per_unit: number;
  unit_of_measure: string;
  unit_price: number;
  total_price: number | null;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  lead_time: number | null;
  routing: string | null;
  notes: string | null;
  tax_category: string | null;
  icms_rate: number | null;
  status: ItemStatus;
  status_changed_at: string;
  created_at: string;
};

function OrderDetail() {
  const { id } = Route.useParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [customerOpen, setCustomerOpen] = useState(false);
  const toggle = (itemId: string) => setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("stale_days").maybeSingle();
      return data;
    },
  });
  const staleDays = settings?.stale_days ?? 3;

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const orderRes = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      const [items, logs, profiles, eng, plan, customer] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
        supabase
          .from("item_status_logs")
          .select("*, order_item:order_items!inner(order_id)")
          .eq("order_item.order_id", id)
          .order("created_at"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("engineering_requests").select("*, order_item:order_items!inner(order_id)").eq("order_item.order_id", id),
        supabase.from("planning_requests").select("*, order_item:order_items!inner(order_id)").eq("order_item.order_id", id),
        supabase
          .from("customers")
          .select("*")
          .ilike("company_name", `%${orderRes.data?.customer_name ?? ""}%`)
          .maybeSingle(),
      ]);
      return {
        order: orderRes.data,
        items: (items.data ?? []) as unknown as Item[],
        logs: (logs.data ?? []) as unknown as {
          id: string;
          order_item_id: string;
          from_status: ItemStatus | null;
          to_status: ItemStatus;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        }[],
        profiles: profiles.data ?? [],
        eng: (eng.data ?? []) as unknown as { order_item_id: string; requested_at: string; responded_at: string | null }[],
        plan: (plan.data ?? []) as unknown as { order_item_id: string; requested_at: string; responded_at: string | null }[],
        customer: customer.data,
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando pedido...</p>;
  if (!data?.order) return <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>;

  const order = data.order as unknown as {
    id: string;
    order_number: string;
    customer_name: string;
    customer_po: string | null;
    status: OrderStatus;
    notes: string | null;
    sap_number: string | null;
    sap_inserted: boolean;
    created_at: string;
    salesperson_id: string;
    cs_owner_id: string | null;
  };
  
  const nameOf = (uid: string | null) => {
    const p = data.profiles.find((x) => x.id === uid);
    return p ? p.full_name || p.email : "—";
  };
  const total = data.items.reduce((a, i) => a + Number(i.total_price ?? 0), 0);
  const allConfirmed = data.items.length > 0 && data.items.every((i) => i.status === "confirmado");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/pedidos" className="mb-1 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 size-4" /> Pedidos
          </Link>
          <h1 className="page-title">{order.customer_po || order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customer_po ? `Interno: ${order.order_number} · ` : ""}
            {order.customer_name} · vendedor {nameOf(order.salesperson_id)} · customer service{" "}
            {order.cs_owner_id ? nameOf(order.cs_owner_id) : "não definido"} · criado em {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} sapInserted={order.sap_inserted} />
          {allConfirmed && (
            <Button asChild size="sm">
              <Link to="/pedidos/$id/confirmacao" params={{ id: order.id }}>
                <FileText className="mr-1 size-4" /> Confirmação
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatCurrency(total)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">SAP</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {order.sap_inserted ? order.sap_number || "Inserido" : "Pendente"}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Itens confirmados</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {data.items.filter((i) => i.status === "confirmado").length}/{data.items.length}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCustomerOpen(true)}
        className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-panel transition-colors hover:bg-muted/30"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Cliente</p>
          <p className="font-display text-lg font-semibold">{order.customer_name}</p>
          {data.customer?.cnpj && (
            <p className="text-xs text-muted-foreground">CNPJ: {data.customer.cnpj}</p>
          )}
        </div>
        <div className="text-sm text-primary hover:underline">Ver informações</div>
      </button>

      {order.notes && (
        <div className="rounded-lg border bg-card p-4 text-sm shadow-panel">
          <p className="mb-1 font-medium">Observações</p>
          <p className="text-muted-foreground">{order.notes}</p>
        </div>
      )}

      <OrderAttachments orderId={order.id} />


      <div className="rounded-lg border bg-card shadow-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Quantidade</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nº de rolos</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Valor NET unit.</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Data de entrega</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((item) => {
                const logs = data.logs.filter((l) => l.order_item_id === item.id);
                const engReq = data.eng.find((r) => r.order_item_id === item.id);
                const planReq = data.plan.find((r) => r.order_item_id === item.id);
                const pending = item.status !== "confirmado" && item.status !== "cancelado";
                const isOpen = expanded[item.id];

                return (
                  <Fragment key={item.id}>
                    <tr
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggle(item.id)}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                          <div>
                            <p className="font-medium">{item.description}</p>
                            {item.product_code && (
                              <p className="text-xs text-muted-foreground">{item.product_code}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums">
                        {Number(item.quantity).toLocaleString("pt-BR")} {item.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums">
                        {Number(item.units_count).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {formatDate(item.requested_delivery_date)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <ItemStatusBadge status={item.status} />
                          {pending && <AgingBadge days={daysSince(item.status_changed_at)} limit={staleDays} />}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="bg-muted/20 px-4 py-4">
                          <div className="space-y-4">
                            <div className="grid gap-3 text-sm sm:grid-cols-4">
                              <Field label="Código" value={item.product_code || "—"} />
                              <Field label="Unidade de medida" value={item.unit_of_measure || "—"} />
                              <Field
                                label="Qtd por unidade"
                                value={
                                  item.qty_per_unit
                                    ? `${Number(item.qty_per_unit).toLocaleString("pt-BR")} ${item.unit_of_measure}`
                                    : "—"
                                }
                              />
                              <Field label="Preço NET unit." value={formatCurrency(item.unit_price)} />
                              <Field label="Data confirmada" value={formatDate(item.confirmed_delivery_date)} />
                              <Field label="Lead time" value={item.lead_time ? `${item.lead_time} dias` : "—"} />
                              <Field label="Roteiro" value={item.routing || "—"} />
                            </div>

                            {item.notes && (
                              <div>
                                <p className="text-xs text-muted-foreground">Observação do item</p>
                                <p className="whitespace-pre-line font-medium">{item.notes}</p>
                              </div>
                            )}

                            {(() => {
                              const cat = findCategoria(item.tax_category);
                              if (!cat) return null;
                              const rate = Number(item.icms_rate ?? 0);
                              const t = calcularImpostos({
                                categoria: cat.code,
                                quantidade: Number(item.quantity),
                                precoNetoUnitario: Number(item.unit_price),
                                aliquotaICMS: rate,
                              });
                              const cells: [string, string][] = [
                                ["Valor líquido total", formatCurrency(t.valorLiquidoTotal)],
                                ["ICMS", formatCurrency(t.valorICMS)],
                                ["PIS", formatCurrency(t.valorPIS)],
                                ["COFINS", formatCurrency(t.valorCOFINS)],
                                ["IPI", formatCurrency(t.valorIPI)],
                                ["Total com impostos", formatCurrency(t.valorTotalComImpostos)],
                                ["Preço unit. c/ impostos", formatCurrency(t.precoUnitarioComImpostos)],
                              ];
                              return (
                                <div className="rounded-md border bg-card p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Impostos · {cat.label} · ICMS {(rate * 100).toFixed(2).replace(".", ",")}%
                                  </p>
                                  <div className="grid gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                                    {cells.map(([label, value]) => (
                                      <div key={label}>
                                        <p className="text-muted-foreground">{label}</p>
                                        <p className="font-medium tabular-nums">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div>
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Linha do tempo
                              </p>
                              <ol className="space-y-3">
                                {logs.map((log) => (
                                  <li key={log.id} className="flex gap-3">
                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                                    <div>
                                      <p className="text-sm font-medium">{itemStatusLabels[log.to_status]}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateTime(log.created_at)} · {nameOf(log.changed_by)}
                                        {log.note ? ` · ${log.note}` : ""}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                                {logs.length === 0 && <li className="text-sm text-muted-foreground">Sem registros.</li>}
                              </ol>

                              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                {engReq && (
                                  <p>
                                    Engenharia: solicitado {formatDateTime(engReq.requested_at)} · resposta{" "}
                                    {engReq.responded_at ? formatDateTime(engReq.responded_at) : "pendente"} (
                                    {durationLabel(engReq.requested_at, engReq.responded_at)})
                                  </p>
                                )}
                                {planReq && (
                                  <p>
                                    Planejamento: solicitado {formatDateTime(planReq.requested_at)} · resposta{" "}
                                    {planReq.responded_at ? formatDateTime(planReq.responded_at) : "pendente"} (
                                    {durationLabel(planReq.requested_at, planReq.responded_at)})
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={customerOpen} onOpenChange={setCustomerOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{order.customer_name}</SheetTitle>
            <SheetDescription>Informações cadastrais do cliente</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 text-sm">
            {data.customer ? (
              <>
                <CustomerField label="CNPJ" value={data.customer.cnpj} />
                <CustomerField label="Código SAP" value={data.customer.sap_code} />
                <CustomerField label="Organização de vendas" value={data.customer.sales_org} />
                <CustomerField label="Canal de distribuição" value={data.customer.distribution_channel} />
                <CustomerField label="Segmento" value={data.customer.segment} />
                <CustomerField label="Key Account" value={data.customer.key_account} />
                <CustomerField label="Endereço" value={data.customer.address} />
                <CustomerField label="Cidade" value={data.customer.city} />
                <CustomerField label="Estado" value={data.customer.state} />
                <CustomerField label="CEP" value={data.customer.zip_code} />
                <CustomerField label="Telefone" value={data.customer.phone} />
                <CustomerField label="E-mail contato" value={data.customer.contact_email} />
                <CustomerField label="E-mail XML" value={data.customer.xml_email} />
                <CustomerField label="Inscrição estadual" value={data.customer.state_registration} />
                <CustomerField label="Condição de pagamento" value={data.customer.payment_terms} />
                <CustomerField label="Incoterms" value={data.customer.incoterms} />
                <CustomerField label="Limite de crédito" value={data.customer.credit_limit} />
                <CustomerField label="Cliente desde" value={data.customer.customer_since} />
                <CustomerField label="Última consulta Serasa" value={data.customer.last_credit_check} />
                {data.customer.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-line font-medium">{data.customer.notes}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Cliente não encontrado na base cadastral.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CustomerField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
