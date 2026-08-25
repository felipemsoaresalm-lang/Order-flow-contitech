import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Factory, Headset, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pré-Entrada de Pedidos | Fluxo entre áreas" },
      {
        name: "description",
        content:
          "Substitua a troca de e-mails: acompanhe cada item do pedido entre Vendas, Customer Service, Engenharia e Planejamento com histórico e indicadores.",
      },
      { property: "og:title", content: "Pré-Entrada de Pedidos" },
      {
        property: "og:description",
        content: "Fluxo de pré-entrada de pedidos com filas por área, prazos e indicadores.",
      },
    ],
  }),
  component: Landing,
});

const areas = [
  { icon: Users, title: "Vendas", text: "Cria o pedido com múltiplos itens e acompanha o status em tempo real." },
  { icon: Headset, title: "Customer Service", text: "Recebe a fila, insere no SAP e dispara as solicitações automaticamente." },
  { icon: Factory, title: "Engenharia", text: "Responde criação de código com lead time e roteiro do produto." },
  { icon: Truck, title: "Planejamento", text: "Informa a data de entrega e conclui o item." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-display text-lg font-bold">Pré-Entrada</span>
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Fluxo interno</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            O caminho do pedido, do vendedor à confirmação, sem uma única thread de e-mail.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Cada item segue seu próprio status. O sistema mostra em que etapa está, quem tem a
            pendência e há quanto tempo — com histórico completo de datas e indicadores de
            tempo de resposta por área.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Acessar o sistema <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-card py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <div key={a.title} className="rounded-lg border p-5 shadow-panel">
                <a.icon className="size-6 text-primary" />
                <h2 className="mt-4 font-display text-lg font-semibold">{a.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{a.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
