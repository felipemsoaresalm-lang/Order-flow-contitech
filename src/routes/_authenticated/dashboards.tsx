import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CircleDollarSign, PackageX, Receipt } from "lucide-react";
import { formatCurrency, itemStatusLabels } from "@/lib/domain";
import {
  analyticsOrdersQuery,
  deliveryDate,
  endOfMonth,
  grossValue,
  isOpenItem,
  monthKey,
  monthLabel,
  netValue,
  startOfToday,
  toDate,
  type AnalyticsItem,
  type AnalyticsOrder,
} from "@/lib/orders-analytics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboards")({
  head: () => ({
    meta: [
      { title: "Dashboards | Pré-Entrada de Pedidos" },
      {
        name: "description",
        content:
          "Dashboards interativos de faturamento previsto, backorder e pedidos ainda não inseridos no sistema.",
      },
      { property: "og:title", content: "Dashboards | Pré-Entrada de Pedidos" },
      {
        property: "og:description",
        content: "Faturamento previsto, backorder e pedidos não inseridos no sistema.",
      },
    ],
  }),
  component: Dashboards,
});

type Flat = { order: AnalyticsOrder; item: AnalyticsItem; date: Date | null };

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
];

function Dashboards() {
  const { data, isLoading } = useQuery(analyticsOrdersQuery);
  const [basis, setBasis] = useState<"net" | "bruto">("net");

  const flat = useMemo<Flat[]>(() => {
    return (data ?? []).flatMap((order) =>
      order.order_items.filter(isOpenItem).map((item) => ({
        order,
        item,
        date: toDate(deliveryDate(item)),
      })),
    );
  }, [data]);

  const value = (f: Flat) => (basis === "net" ? netValue(f.item) : grossValue(f.item));

  const today = startOfToday();
  const monthEnd = endOfMonth(0);

  const previstoMes = flat.filter((f) => f.date && f.date >= today && f.date <= monthEnd);
  const backorder = flat.filter(
    (f) => f.date && f.date < today && f.item.status !== "confirmado",
  );
  const naoInseridos = (data ?? []).filter((o) => !o.sap_inserted && o.status !== "cancelado");

  const sum = (list: Flat[]) => list.reduce((a, f) => a + value(f), 0);

  const naoInseridosValor = naoInseridos.reduce(
    (a, o) =>
      a +
      o.order_items
        .filter(isOpenItem)
        .reduce((s, i) => s + (basis === "net" ? netValue(i) : grossValue(i)), 0),
    0,
  );

  const porMes = useMemo(() => {
    const map = new Map<string, { previsto: number; backorder: number }>();
    flat.forEach((f) => {
      if (!f.date) return;
      const key = monthKey(f.date);
      const entry = map.get(key) ?? { previsto: 0, backorder: 0 };
      const v = value(f);
      if (f.date < today && f.item.status !== "confirmado") entry.backorder += v;
      else entry.previsto += v;
      map.set(key, entry);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-9)
      .map(([key, v]) => ({ mes: monthLabel(key), ...v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, basis]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((f) => map.set(f.item.status, (map.get(f.item.status) ?? 0) + value(f)));
    return [...map.entries()].map(([status, valor]) => ({
      name: itemStatusLabels[status as keyof typeof itemStatusLabels] ?? status,
      value: Math.round(valor),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, basis]);

  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((f) => map.set(f.order.customer_name, (map.get(f.order.customer_name) ?? 0) + value(f)));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cliente, valor]) => ({ cliente, valor: Math.round(valor) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, basis]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboards</h1>
          <p className="text-sm text-muted-foreground">
            Faturamento previsto, backorder e pedidos pendentes de inserção no sistema.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-card p-1">
          <Button
            size="sm"
            variant={basis === "net" ? "default" : "ghost"}
            onClick={() => setBasis("net")}
          >
            Valor NET
          </Button>
          <Button
            size="sm"
            variant={basis === "bruto" ? "default" : "ghost"}
            onClick={() => setBasis("bruto")}
          >
            Com impostos
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={CircleDollarSign}
          label="Faturamento previsto do mês"
          value={formatCurrency(sum(previstoMes))}
          hint={`${previstoMes.length} itens com entrega até ${monthEnd.toLocaleDateString("pt-BR")}`}
        />
        <Stat
          icon={AlertTriangle}
          label="Backorder (entrega vencida)"
          value={formatCurrency(sum(backorder))}
          hint={`${backorder.length} itens em atraso`}
          alert={backorder.length > 0}
        />
        <Stat
          icon={PackageX}
          label="Pedidos não inseridos no sistema"
          value={String(naoInseridos.length)}
          hint={formatCurrency(naoInseridosValor)}
          alert={naoInseridos.length > 0}
        />
        <Stat
          icon={Receipt}
          label="Carteira total em aberto"
          value={formatCurrency(sum(flat.filter((f) => f.item.status !== "confirmado")))}
          hint={`${flat.length} itens ativos`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Faturamento previsto por mês de entrega">
          <ChartBox loading={isLoading} empty={porMes.length === 0}>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={80} tickFormatter={(v) => compact(Number(v))} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="backorder" name="Backorder" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Panel>

        <Panel title="Distribuição por status do item">
          <ChartBox loading={isLoading} empty={porStatus.length === 0}>
            <PieChart>
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Pie data={porStatus} dataKey="value" nameKey="name" outerRadius={100} label={false}>
                {porStatus.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartBox>
        </Panel>

        <Panel title="Top clientes por valor em carteira">
          <ChartBox loading={isLoading} empty={topClientes.length === 0}>
            <BarChart data={topClientes} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => compact(Number(v))} />
              <YAxis type="category" dataKey="cliente" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="valor" name="Valor" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </Panel>

        <Panel title="Pedidos ainda não inseridos no sistema">
          <div className="max-h-[320px] divide-y overflow-y-auto">
            {naoInseridos.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Todos os pedidos já foram inseridos no sistema.
              </p>
            )}
            {naoInseridos.map((o) => (
              <Link
                key={o.id}
                to="/pedidos/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.customer_po || o.order_number}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.customer_name}</p>
                </div>
                <span className="text-sm font-medium">
                  {formatCurrency(
                    o.order_items
                      .filter(isOpenItem)
                      .reduce((s, i) => s + (basis === "net" ? netValue(i) : grossValue(i)), 0),
                  )}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function compact(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card shadow-panel">
      <div className="border-b px-4 py-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ChartBox({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: React.ReactElement;
}) {
  if (loading) return <p className="px-4 py-16 text-sm text-muted-foreground">Carregando...</p>;
  if (empty) return <p className="px-4 py-16 text-sm text-muted-foreground">Sem dados suficientes.</p>;
  return (
    <div className="h-[300px] w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={alert ? "size-4 text-destructive" : "size-4 text-primary"} />
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
