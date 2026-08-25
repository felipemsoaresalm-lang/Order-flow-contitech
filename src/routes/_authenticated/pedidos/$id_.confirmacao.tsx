import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, type ItemStatus } from "@/lib/domain";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pedidos/$id_/confirmacao")({
  head: () => ({
    meta: [
      { title: "Confirmação de pedido | Pré-Entrada de Pedidos" },
      { name: "description", content: "Documento de confirmação de pedido com itens, preços e datas de entrega confirmadas." },
      { property: "og:title", content: "Confirmação de pedido" },
      { property: "og:description", content: "Documento pronto para envio ao cliente." },
    ],
  }),
  component: Confirmation,
});

function Confirmation() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["confirmacao", id],
    queryFn: async () => {
      const [order, items] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
      ]);
      return { order: order.data, items: (items.data ?? []) as unknown as Array<{
        id: string;
        product_code: string | null;
        description: string;
        quantity: number;
        unit_price: number;
        total_price: number | null;
        confirmed_delivery_date: string | null;
        status: ItemStatus;
      }> };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data?.order) return <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>;

  const order = data.order as unknown as {
    id: string;
    order_number: string;
    customer_name: string;
    created_at: string;
    sap_number: string | null;
    notes: string | null;
  };
  const pendentes = data.items.filter((i) => i.status !== "confirmado");
  const total = data.items.reduce((a, i) => a + Number(i.total_price ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link to="/pedidos/$id" params={{ id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 size-4" /> Voltar ao pedido
        </Link>
        <Button onClick={() => window.print()} disabled={pendentes.length > 0}>
          <Printer className="mr-1 size-4" /> Imprimir / PDF
        </Button>
      </div>

      {pendentes.length > 0 && (
        <div className="no-print rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          A confirmação só pode ser emitida quando todos os itens estiverem confirmados. Faltam{" "}
          {pendentes.length} item(ns) com código e data de entrega.
        </div>
      )}

      <div className="rounded-lg border bg-card p-8 shadow-panel">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Confirmação de Pedido</h1>
            <p className="mt-1 text-sm text-muted-foreground">Documento gerado automaticamente pelo sistema.</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-display text-xl font-bold">{order.order_number}</p>
            <p className="text-muted-foreground">Emissão: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        <div className="grid gap-4 py-6 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{order.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data do pedido</p>
            <p className="font-medium">{formatDate(order.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nº SAP</p>
            <p className="font-medium">{order.sap_number || "—"}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="border-y text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Código</th>
              <th className="py-2">Descrição</th>
              <th className="py-2 text-right">Qtd</th>
              <th className="py-2 text-right">Preço unit.</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2 text-right">Entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.product_code || "—"}</td>
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 text-right">{formatCurrency(item.total_price)}</td>
                <td className="py-2 text-right">{formatDate(item.confirmed_delivery_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end border-t pt-4">
          <p className="font-display text-lg font-bold">Total do pedido: {formatCurrency(total)}</p>
        </div>

        {order.notes && (
          <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">Observações: {order.notes}</p>
        )}
      </div>
    </div>
  );
}
