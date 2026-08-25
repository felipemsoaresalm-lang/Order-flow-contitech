import { supabase } from "@/integrations/supabase/client";
import type { AppRole, ItemStatus, OrderStatus } from "@/lib/domain";

export type NewItemInput = {
  product_code: string;
  description: string;
  units_count: number;
  qty_per_unit: number;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  requested_delivery_date: string | null;
  notes: string | null;
  tax_category: string;
  icms_rate: number;
};

export const ATTACHMENTS_BUCKET = "order-attachments";

/** Envia vários arquivos de uma vez e registra os anexos do pedido. */
export async function uploadOrderAttachments(orderId: string, files: File[], userId: string) {
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${orderId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await supabase.from("order_attachments").insert({
      order_id: orderId,
      file_name: file.name,
      file_path: path,
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    });
    if (error) throw error;
  }
}

export async function deleteOrderAttachment(id: string, path: string) {
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
  const { error } = await supabase.from("order_attachments").delete().eq("id", id);
  if (error) throw error;
}


async function notify(params: {
  role?: AppRole;
  title: string;
  body?: string;
  orderId?: string | null;
  userId?: string | null;
}) {
  await supabase.from("notifications").insert({
    target_role: params.userId ? null : (params.role ?? null),
    user_id: params.userId ?? null,
    title: params.title,
    body: params.body ?? null,
    order_id: params.orderId ?? null,
  });
}

async function logStatus(
  itemId: string,
  from: ItemStatus | null,
  to: ItemStatus,
  userId: string | null,
  note?: string,
) {
  await supabase.from("item_status_logs").insert({
    order_item_id: itemId,
    from_status: from,
    to_status: to,
    changed_by: userId,
    note: note ?? null,
  });
}

export async function recomputeOrderStatus(orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("status")
    .eq("order_id", orderId);

  const list = (items ?? []) as { status: ItemStatus }[];
  const active = list.filter((i) => i.status !== "cancelado");
  let status: OrderStatus = "em_processamento";
  let confirmedAt: string | null = null;

  if (active.length > 0 && active.every((i) => i.status === "confirmado")) {
    status = "confirmado";
    confirmedAt = new Date().toISOString();
  } else if (active.some((i) => i.status === "aguardando_codigo")) {
    status = "em_processamento";
  } else if (active.some((i) => i.status === "aguardando_data")) {
    status = "aguardando_planejamento";
  } else if (active.every((i) => i.status === "novo")) {
    status = "aberto";
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, order_number, salesperson_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status === status) return status;

  await supabase
    .from("orders")
    .update({ status, confirmed_at: confirmedAt })
    .eq("id", orderId);

  if (status === "confirmado") {
    await notify({
      role: "vendas",
      userId: order.salesperson_id,
      title: `Pedido ${order.order_number} confirmado`,
      body: "Todos os itens possuem código e data de entrega confirmada.",
      orderId,
    });
  }
  return status;
}

export async function createOrder(input: {
  customerName: string;
  customerPo?: string | null;
  orderDate?: string | null;
  notes: string;
  items: NewItemInput[];
  userId: string;
  csOwnerId?: string | null;
}) {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_name: input.customerName,
      customer_po: input.customerPo?.trim() || null,
      order_date: input.orderDate || new Date().toISOString().slice(0, 10),
      salesperson_id: input.userId,
      cs_owner_id: input.csOwnerId || null,
      notes: input.notes || null,
      status: "em_processamento",
    })
    .select("id, order_number")
    .single();
  if (error || !order) throw error ?? new Error("Falha ao criar pedido");

  for (const item of input.items) {
    const hasCode = item.product_code.trim().length > 0;
    const status: ItemStatus = hasCode ? "aguardando_data" : "aguardando_codigo";
    const { data: created, error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_code: hasCode ? item.product_code.trim() : null,
        description: item.description,
        quantity: item.quantity,
        units_count: item.units_count,
        qty_per_unit: item.qty_per_unit,
        unit_of_measure: item.unit_of_measure,
        unit_price: item.unit_price,
        requested_delivery_date: item.requested_delivery_date,
        notes: item.notes,
        tax_category: item.tax_category,
        icms_rate: item.icms_rate,
        status,
      })
      .select("id")
      .single();

    if (itemError || !created) throw itemError ?? new Error("Falha ao criar item");

    await logStatus(created.id, "novo", status, input.userId, "Criação do pedido");

    if (hasCode) {
      await supabase.from("planning_requests").insert({
        order_item_id: created.id,
        requested_by: input.userId,
      });
    }
  }

  await notify({
    role: "customer_service",
    userId: input.csOwnerId ?? null,
    title: `Novo pedido ${order.order_number}`,
    body: `Cliente ${input.customerName} — ${input.items.length} item(ns) para processar.`,
    orderId: order.id,
  });

  const hasNoCode = input.items.some((i) => !i.product_code.trim());
  if (hasNoCode) {
    await notify({
      role: "customer_service",
      userId: input.csOwnerId ?? null,
      title: `Itens sem código — pedido ${order.order_number}`,
      body: "Verifique se já existe código cadastrado ou envie para a Engenharia.",
      orderId: order.id,
    });
  }
  if (input.items.some((i) => i.product_code.trim())) {
    await notify({
      role: "planejamento",
      title: `Solicitação de data — pedido ${order.order_number}`,
      body: "Há itens aguardando data de entrega.",
      orderId: order.id,
    });
  }

  await recomputeOrderStatus(order.id);
  return order;
}

export async function assignExistingCode(params: {
  itemId: string;
  orderId: string;
  orderNumber: string;
  productCode: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("order_items")
    .update({ product_code: params.productCode, status: "aguardando_data" })
    .eq("id", params.itemId);
  if (error) throw error;

  await logStatus(params.itemId, "aguardando_codigo", "codigo_recebido", params.userId, "Customer Service informou código existente");
  await logStatus(params.itemId, "codigo_recebido", "aguardando_data", params.userId, "Data solicitada ao Planejamento");

  await supabase.from("planning_requests").insert({
    order_item_id: params.itemId,
    requested_by: params.userId,
  });

  await notify({
    role: "planejamento",
    title: `Nova solicitação de data — pedido ${params.orderNumber}`,
    body: `Item ${params.productCode} aguardando data de entrega.`,
    orderId: params.orderId,
  });

  await recomputeOrderStatus(params.orderId);
}

export async function sendToEngineering(params: {
  itemId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
}) {
  const { error } = await supabase.from("engineering_requests").insert({
    order_item_id: params.itemId,
    requested_by: params.userId,
  });
  if (error) throw error;

  await supabase.from("orders").update({ status: "aguardando_engenharia" }).eq("id", params.orderId);

  await logStatus(params.itemId, "aguardando_codigo", "aguardando_codigo", params.userId, "Enviado à Engenharia para criação de código");

  await notify({
    role: "engenharia",
    title: `Solicitação de código — pedido ${params.orderNumber}`,
    body: "Item sem código de produto aguardando criação.",
    orderId: params.orderId,
  });
}

export async function respondEngineering(params: {
  requestId: string;
  itemId: string;
  orderId: string;
  orderNumber: string;
  productCode: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("engineering_requests")
    .update({
      status: "respondida",
      responded_at: now,
      responded_by: params.userId,
      product_code: params.productCode,
    })
    .eq("id", params.requestId);
  if (error) throw error;

  await supabase
    .from("order_items")
    .update({
      product_code: params.productCode,
      status: "aguardando_data",
    })
    .eq("id", params.itemId);

  await logStatus(params.itemId, "aguardando_codigo", "codigo_recebido", params.userId, "Engenharia respondeu");
  await logStatus(params.itemId, "codigo_recebido", "aguardando_data", params.userId, "Data solicitada ao Planejamento");

  await supabase.from("products").upsert(
    { code: params.productCode, description: "" },
    { onConflict: "code", ignoreDuplicates: true },
  );

  await supabase.from("planning_requests").insert({
    order_item_id: params.itemId,
    requested_by: params.userId,
  });

  await notify({
    role: "customer_service",
    title: `Engenharia respondeu — pedido ${params.orderNumber}`,
    body: `Código ${params.productCode} criado. Data solicitada ao Planejamento.`,
    orderId: params.orderId,
  });
  await notify({
    role: "planejamento",
    title: `Nova solicitação de data — pedido ${params.orderNumber}`,
    body: `Item ${params.productCode} aguardando data de entrega.`,
    orderId: params.orderId,
  });

  await recomputeOrderStatus(params.orderId);
}

export async function respondPlanning(params: {
  requestId: string;
  itemId: string;
  orderId: string;
  orderNumber: string;
  deliveryDate: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("planning_requests")
    .update({
      status: "respondida",
      responded_at: now,
      responded_by: params.userId,
      delivery_date: params.deliveryDate,
    })
    .eq("id", params.requestId);
  if (error) throw error;

  const { error: itemError } = await supabase
    .from("order_items")
    .update({
      confirmed_delivery_date: params.deliveryDate,
      status: "confirmado",
    })
    .eq("id", params.itemId);
  if (itemError) throw itemError;

  await logStatus(params.itemId, "aguardando_data", "confirmado", params.userId, "Planejamento informou a data");

  await notify({
    role: "customer_service",
    title: `Planejamento respondeu — pedido ${params.orderNumber}`,
    body: "Item confirmado com data de entrega.",
    orderId: params.orderId,
  });

  await recomputeOrderStatus(params.orderId);
}

export async function markSapInserted(orderId: string, sapNumber: string) {
  const { error } = await supabase
    .from("orders")
    .update({ sap_inserted: true, sap_number: sapNumber || null })
    .eq("id", orderId);
  if (error) throw error;
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}
