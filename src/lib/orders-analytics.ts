import { supabase } from "@/integrations/supabase/client";
import { calcularImpostos } from "@/lib/tax";
import type { ItemStatus, OrderStatus } from "@/lib/domain";

export type AnalyticsItem = {
  id: string;
  product_code: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number | null;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  status: ItemStatus;
  tax_category: string;
  icms_rate: number;
  units_count: number;
};

export type AnalyticsOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_po: string | null;
  status: OrderStatus;
  sap_inserted: boolean;
  order_date: string;
  created_at: string;
  cs_owner_id: string | null;
  salesperson_id: string;
  order_items: AnalyticsItem[];
};

export const analyticsOrdersQuery = {
  queryKey: ["orders", "analytics"] as const,
  queryFn: async (): Promise<AnalyticsOrder[]> => {
    const { data } = await supabase
      .from("orders")
      .select(`
        id, order_number, customer_name, customer_po, status, sap_inserted, order_date,
        created_at, cs_owner_id, salesperson_id,
        order_items(
          id, product_code, description, quantity, unit_price, total_price,
          requested_delivery_date, confirmed_delivery_date, status, tax_category,
          icms_rate, units_count
        )
      `)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as AnalyticsOrder[];
  },
};

/** Data de entrega efetiva do item: confirmada quando existir, senão a solicitada. */
export function deliveryDate(item: AnalyticsItem) {
  return item.confirmed_delivery_date ?? item.requested_delivery_date ?? null;
}

export function netValue(item: AnalyticsItem) {
  return Number(item.total_price ?? item.unit_price * item.quantity) || 0;
}

export function grossValue(item: AnalyticsItem) {
  return calcularImpostos({
    categoria: item.tax_category,
    quantidade: Number(item.quantity) || 0,
    precoNetoUnitario: Number(item.unit_price) || 0,
    aliquotaICMS: Number(item.icms_rate) || 0,
  }).valorTotalComImpostos;
}

export function isOpenItem(item: AnalyticsItem) {
  return item.status !== "cancelado";
}

export function toDate(value?: string | null) {
  if (!value) return null;
  return new Date(value.length <= 10 ? `${value}T12:00:00` : value);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(offsetMonths = 0) {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths + 1);
  d.setDate(0);
  return d;
}

export function addDays(days: number) {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(y, m - 1, 1),
  );
}
