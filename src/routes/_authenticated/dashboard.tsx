import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Factory, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysSince, durationLabel, type ItemStatus } from "@/lib/domain";
import { AgingBadge, ItemStatusBadge } from "@/components/StatusBadges";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Pré-Entrada de Pedidos" },
      { name: "description", content: "Indicadores do fluxo de pedidos: pendências por área, itens parados e tempos médios de resposta." },
      { property: "og:title", content: "Dashboard | Pré-Entrada de Pedidos" },
      { property: "og:description", content: "Pendências por área, itens parados e tempos médios de resposta." },
    ],
  }),
  component: Dashboard,
});

type StuckItem = {
  id: string;
  description: string;
  product_code: string | null;
  status: ItemStatus;
  status_changed_at: string;
  order: { id: string; order_number: string; customer_name: string } | null;
};

function avgHours(rows: { requested_at: string; responded_at: string | null }[]) {
  const done = rows.filter((r) => r.responded_at);
  if (done.length === 0) return null;
  const total = done.reduce(
    (acc, r) => acc + (new Date(r.responded_at!).getTime() - new Date(r.requested_at).getTime()),
    0,
  );
  return total / done.length / 3_600_000;
}

function hoursLabel(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

function Dashboard() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("stale_days").maybeSingle();
      return data;
    },
  });
  const staleDays = settings?.stale_days ?? 3;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [orders, items, eng, plan] = await Promise.all([
        supabase.from("orders").select("id, status, created_at, confirmed_at"),
        supabase
          .from("order_items")
          .select(
            "id, description, product_code, status, status_changed_at, confirmed_at, order:orders(id, order_number, customer_name)",
          )
          .order("status_changed_at", { ascending: true }),
        supabase.from("engineering_requests").select("requested_at, responded_at"),
        supabase.from("planning_requests").select("requested_at, responded_at"),
      ]);

      const allItems = (items.data ?? []) as unknown as (StuckItem & { confirmed_at: string | null })[];
      const allOrders = (orders.data ?? []) as {
        id: string;
        status: string;
        created_at: string;
        confirmed_at: string | null;
      }[];

      const confirmedOrders = allOrders.filter((o) => o.confirmed_at);
      const avgOrderHours =
        confirmedOrders.length === 0
          ? null
          : confirmedOrders.reduce(
              (acc, o) => acc + (new Date(o.confirmed_at!).getTime() - new Date(o.created_at).getTime()),
              0,
            ) /
            confirmedOrders.length /
            3_600_000;

      return {
        openOrders: allOrders.filter((o) => !["confirmado", "cancelado"].includes(o.status)).length,
        waitingEng: allItems.filter((i) => i.status === "aguardando_codigo"),
        waitingPlan: allItems.filter((i) => i.status === "aguardando_data"),
        confirmedMonth: allItems.filter(
          (i) => i.status === "confirmado" && i.confirmed_at && new Date(i.confirmed_at) >= monthStart,
        ).length,
        avgEng: avgHours(eng.data ?? []),
        avgPlan: avgHours(plan.data ?? []),
        avgOrderHours,
      };
    },
  });

  const waitingEng = data?.waitingEng ?? [];
  const waitingPlan = data?.waitingPlan ?? [];
  const lateCount = [...waitingEng, ...waitingPlan].filter(
    (i) => daysSince(i.status_changed_at) >= staleDays,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do fluxo de pré-entrada. Itens parados há {staleDays} dias ou mais aparecem em vermelho.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ClipboardList} label="Pedidos abertos" value={data?.openOrders ?? 0} />
        <Stat icon={Factory} label="Itens aguardando Engenharia" value={waitingEng.length} />
        <Stat icon={Truck} label="Itens aguardando Planejamento" value={waitingPlan.length} />
        <Stat icon={CheckCircle2} label="Itens confirmados no mês" value={data?.confirmedMonth ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Clock} label="Tempo médio Engenharia" value={hoursLabel(data?.avgEng ?? null)} />
        <Stat icon={Clock} label="Tempo médio Planejamento" value={hoursLabel(data?.avgPlan ?? null)} />
        <Stat icon={Clock} label="Tempo médio do pedido" value={hoursLabel(data?.avgOrderHours ?? null)} />
        <Stat icon={AlertTriangle} label={`Itens parados +${staleDays} dias`} value={lateCount} alert={lateCount > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StuckList title="Mais antigos na Engenharia" items={waitingEng.slice(0, 8)} staleDays={staleDays} loading={isLoading} />
        <StuckList title="Mais antigos no Planejamento" items={waitingPlan.slice(0, 8)} staleDays={staleDays} loading={isLoading} />
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
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={alert ? "size-4 text-destructive" : "size-4 text-primary"} />
      </div>
      <p className={`mt-2 font-display text-3xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function StuckList({
  title,
  items,
  staleDays,
  loading,
}: {
  title: string;
  items: StuckItem[];
  staleDays: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-panel">
      <div className="border-b px-4 py-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y">
        {loading && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma pendência nesta etapa.</p>
        )}
        {items.map((item) => (
          <Link
            key={item.id}
            to="/pedidos/$id"
            params={{ id: item.order?.id ?? "" }}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.order?.order_number} — {item.description}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.order?.customer_name} · parado {durationLabel(item.status_changed_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ItemStatusBadge status={item.status} />
              <AgingBadge days={daysSince(item.status_changed_at)} limit={staleDays} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
