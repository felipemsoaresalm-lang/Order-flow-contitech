import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/domain";
import { ItemStatusBadge } from "@/components/StatusBadges";
import {
  addDays,
  analyticsOrdersQuery,
  deliveryDate,
  endOfMonth,
  grossValue,
  isOpenItem,
  netValue,
  startOfToday,
  toDate,
  type AnalyticsItem,
  type AnalyticsOrder,
} from "@/lib/orders-analytics";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento | Pré-Entrada de Pedidos" },
      {
        name: "description",
        content:
          "Alertas de pedidos próximos da data de entrega, com horizonte configurável e destaque para itens atrasados.",
      },
      { property: "og:title", content: "Acompanhamento | Pré-Entrada de Pedidos" },
      { property: "og:description", content: "Alertas de entregas próximas e itens atrasados." },
    ],
  }),
  component: Acompanhamento,
});

const HORIZONS = [
  { value: "7", label: "Próximos 7 dias" },
  { value: "15", label: "Próximos 15 dias" },
  { value: "30", label: "Próximos 30 dias" },
  { value: "mes", label: "Até o final deste mês" },
  { value: "mes_seguinte", label: "Até o final do mês seguinte" },
  { value: "60", label: "Próximos 60 dias" },
  { value: "90", label: "Próximos 90 dias" },
  { value: "custom", label: "Data personalizada" },
];

type Line = { order: AnalyticsOrder; item: AnalyticsItem; date: Date; days: number };

function Acompanhamento() {
  const { data, isLoading } = useQuery(analyticsOrdersQuery);
  const [horizon, setHorizon] = useState("mes_seguinte");
  const [customDate, setCustomDate] = useState("");
  const [search, setSearch] = useState("");

  const today = startOfToday();

  const limit = useMemo(() => {
    if (horizon === "mes") return endOfMonth(0);
    if (horizon === "mes_seguinte") return endOfMonth(1);
    if (horizon === "custom") return toDate(customDate) ?? endOfMonth(1);
    return addDays(Number(horizon));
  }, [horizon, customDate]);

  const lines = useMemo<Line[]>(() => {
    const out: Line[] = [];
    (data ?? []).forEach((order) => {
      order.order_items.filter(isOpenItem).forEach((item) => {
        const d = toDate(deliveryDate(item));
        if (!d) return;
        if (d > limit) return;
        out.push({
          order,
          item,
          date: d,
          days: Math.round((d.getTime() - today.getTime()) / 86_400_000),
        });
      });
    });
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data, limit, today]);

  const filtered = lines.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.order.customer_name.toLowerCase().includes(q) ||
      (l.order.customer_po ?? "").toLowerCase().includes(q) ||
      l.order.order_number.toLowerCase().includes(q) ||
      l.item.description.toLowerCase().includes(q)
    );
  });

  const atrasados = filtered.filter((l) => l.days < 0 && l.item.status !== "confirmado");
  const hojeSemana = filtered.filter((l) => l.days >= 0 && l.days <= 7);
  const pendentesConfirmacao = filtered.filter((l) => l.item.status !== "confirmado");
  const totalValor = filtered.reduce((a, l) => a + netValue(l.item), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Acompanhamento de entregas</h1>
        <p className="text-sm text-muted-foreground">
          Alertas de itens com data de entrega dentro do horizonte escolhido — até{" "}
          {limit.toLocaleDateString("pt-BR")}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={horizon} onValueChange={setHorizon}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Horizonte" />
          </SelectTrigger>
          <SelectContent>
            {HORIZONS.map((h) => (
              <SelectItem key={h.value} value={h.value}>
                {h.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {horizon === "custom" && (
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="w-44"
          />
        )}
        <Input
          placeholder="Buscar cliente, pedido ou item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {atrasados.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {atrasados.length} {atrasados.length === 1 ? "item atrasado" : "itens atrasados"}
            </p>
            <p className="text-xs text-muted-foreground">
              Entrega vencida e ainda sem confirmação — priorize estes itens.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CalendarClock} label="Itens no horizonte" value={String(filtered.length)} />
        <Stat icon={AlertTriangle} label="Atrasados" value={String(atrasados.length)} alert={atrasados.length > 0} />
        <Stat icon={Clock} label="Entregas em até 7 dias" value={String(hojeSemana.length)} />
        <Stat icon={CheckCircle2} label="Valor NET no horizonte" value={formatCurrency(totalValor)} />
      </div>

      <div className="rounded-lg border bg-card shadow-panel">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-display text-base font-semibold">Itens por data de entrega</h2>
          <span className="text-xs text-muted-foreground">
            {pendentesConfirmacao.length} ainda não confirmados
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Entrega</th>
                <th className="px-4 py-2 font-medium">Prazo</th>
                <th className="px-4 py-2 font-medium">Pedido do cliente</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">Qtd</th>
                <th className="px-4 py-2 text-right font-medium">Valor NET</th>
                <th className="px-4 py-2 text-right font-medium">Com impostos</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-muted-foreground">
                    Nenhum item com entrega dentro deste horizonte.
                  </td>
                </tr>
              )}
              {filtered.map((l) => {
                const late = l.days < 0 && l.item.status !== "confirmado";
                return (
                  <tr key={l.item.id} className={late ? "bg-destructive/5" : undefined}>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">
                      {formatDate(l.date.toISOString())}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={
                          late
                            ? "font-medium text-destructive"
                            : l.days <= 7
                              ? "font-medium text-warning-foreground"
                              : "text-muted-foreground"
                        }
                      >
                        {l.days < 0
                          ? `${Math.abs(l.days)} ${Math.abs(l.days) === 1 ? "dia" : "dias"} em atraso`
                          : l.days === 0
                            ? "hoje"
                            : `em ${l.days} ${l.days === 1 ? "dia" : "dias"}`}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to="/pedidos/$id"
                        params={{ id: l.order.id }}
                        className="text-primary hover:underline"
                      >
                        {l.order.customer_po || l.order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{l.order.customer_name}</td>
                    <td className="max-w-[280px] truncate px-4 py-2">{l.item.description}</td>
                    <td className="px-4 py-2 text-right">{Number(l.item.quantity)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(netValue(l.item))}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(grossValue(l.item))}</td>
                    <td className="px-4 py-2">
                      <ItemStatusBadge status={l.item.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={alert ? "size-4 text-destructive" : "size-4 text-primary"} />
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
