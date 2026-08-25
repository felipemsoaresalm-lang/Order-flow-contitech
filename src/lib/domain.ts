export type AppRole =
  | "vendas"
  | "customer_service"
  | "engenharia"
  | "planejamento"
  | "admin";

export type ItemStatus =
  | "novo"
  | "aguardando_codigo"
  | "codigo_recebido"
  | "aguardando_data"
  | "confirmado"
  | "cancelado";

export type OrderStatus =
  | "aberto"
  | "em_processamento"
  | "aguardando_engenharia"
  | "aguardando_planejamento"
  | "confirmado"
  | "cancelado";

export const roleLabels: Record<AppRole, string> = {
  vendas: "Vendas",
  customer_service: "Customer Service",
  engenharia: "Engenharia",
  planejamento: "Planejamento",
  admin: "Administrador",
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  novo: "Novo",
  aguardando_codigo: "Aguardando código",
  codigo_recebido: "Código recebido",
  aguardando_data: "Aguardando data (Planejamento)",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  aberto: "Aberto",
  em_processamento: "Em processamento",
  aguardando_engenharia: "Aguardando engenharia",
  aguardando_planejamento: "Aguardando planejamento",
  confirmado: "Não inserido no sistema",
  cancelado: "Cancelado",
};

type Tone = "muted" | "warning" | "info" | "success" | "destructive" | "primary";

/** Rótulo/tom do status do pedido: quando os itens estão confirmados, o pedido
 * só aparece como "Inserido no sistema" depois que o Customer Service inserir
 * o número do pedido no sistema. */
export function orderStatusDisplay(status: OrderStatus, sapInserted?: boolean) {
  if (status === "confirmado") {
    return sapInserted
      ? { label: "Inserido no sistema", tone: "success" as Tone }
      : { label: "Não inserido no sistema", tone: "warning" as Tone };
  }
  return { label: orderStatusLabels[status], tone: orderStatusTone[status] };
}

export const itemStatusTone: Record<ItemStatus, Tone> = {
  novo: "muted",
  aguardando_codigo: "warning",
  codigo_recebido: "info",
  aguardando_data: "warning",
  confirmado: "success",
  cancelado: "destructive",
};

export const orderStatusTone: Record<OrderStatus, Tone> = {
  aberto: "muted",
  em_processamento: "info",
  aguardando_engenharia: "warning",
  aguardando_planejamento: "warning",
  confirmado: "success",
  cancelado: "destructive",
};

export const toneClass: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  info: "bg-info/12 text-info border-info/35",
  success: "bg-success/15 text-success border-success/40",
  destructive: "bg-destructive/12 text-destructive border-destructive/35",
  primary: "bg-primary/12 text-primary border-primary/30",
};

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function daysSince(value?: string | null) {
  if (!value) return 0;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

export function durationLabel(from?: string | null, to?: string | null) {
  if (!from) return "—";
  const end = to ? new Date(to).getTime() : Date.now();
  const diff = Math.max(0, end - new Date(from).getTime());
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60_000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} dias`;
}
