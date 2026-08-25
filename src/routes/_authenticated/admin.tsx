import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { roleLabels, type AppRole } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Pré-Entrada de Pedidos" },
      { name: "description", content: "Gestão de usuários, perfis de acesso, cadastro de produtos e parâmetros do sistema." },
      { property: "og:title", content: "Administração" },
      { property: "og:description", content: "Usuários, perfis, produtos e parâmetros." },
    ],
  }),
  component: Admin,
});

const ROLES: AppRole[] = ["vendas", "customer_service", "engenharia", "planejamento", "admin"];

function Admin() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [product, setProduct] = useState({ code: "", description: "", lt: "" });
  const [unit, setUnit] = useState({ code: "", description: "" });


  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: ((roles ?? []) as { user_id: string; role: AppRole }[])
          .filter((r) => r.user_id === p.id)
          .map((r) => r.role),
      }));
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("code");
      return data ?? [];
    },
  });

  const { data: units } = useQuery({
    queryKey: ["admin-units"],
    queryFn: async () => {
      const { data } = await supabase.from("units_of_measure").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").maybeSingle()).data,
  });


  if (!hasRole("admin")) {
    return <p className="text-sm text-muted-foreground">Área restrita a administradores.</p>;
  }

  const setRole = async (userId: string, role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error("Não foi possível alterar o perfil", { description: error.message });
      return;
    }
    toast.success("Perfil atualizado.");
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("products").upsert(
      {
        code: product.code.trim(),
        description: product.description,
        default_lead_time: product.lt ? Number(product.lt) : null,
      },
      { onConflict: "code" },
    );
    if (error) {
      toast.error("Não foi possível salvar o produto", { description: error.message });
      return;
    }
    toast.success("Produto salvo.");
    setProduct({ code: "", description: "", lt: "" });
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("units_of_measure").upsert(
      {
        code: unit.code.trim().toUpperCase(),
        description: unit.description,
        sort_order: (units?.length ?? 0) + 1,
      },
      { onConflict: "code" },
    );
    if (error) {
      toast.error("Não foi possível salvar a unidade", { description: error.message });
      return;
    }
    toast.success("Unidade de medida salva.");
    setUnit({ code: "", description: "" });
    void queryClient.invalidateQueries({ queryKey: ["admin-units"] });
    void queryClient.invalidateQueries({ queryKey: ["units-of-measure"] });
  };


  const saveStaleDays = async (value: number) => {
    const { error } = await supabase.from("app_settings").update({ stale_days: value }).eq("id", true);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Parâmetro atualizado.");
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Administração</h1>
        <p className="text-sm text-muted-foreground">Usuários, produtos e parâmetros do fluxo.</p>
      </div>

      <section className="rounded-lg border bg-card shadow-panel">
        <div className="border-b px-4 py-3">
          <h2 className="font-display text-base font-semibold">Usuários e perfis</h2>
        </div>
        <div className="divide-y">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.full_name || "(sem nome)"}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Select value={u.roles[0] ?? ""} onValueChange={(v) => setRole(u.id, v as AppRole)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Sem perfil" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card shadow-panel">
        <div className="border-b px-4 py-3">
          <h2 className="font-display text-base font-semibold">Cadastro de produtos</h2>
        </div>
        <form onSubmit={addProduct} className="grid gap-3 border-b p-4 md:grid-cols-12">
          <div className="space-y-1.5 md:col-span-3">
            <Label>Código</Label>
            <Input required value={product.code} onChange={(e) => setProduct((p) => ({ ...p, code: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-5">
            <Label>Descrição</Label>
            <Input value={product.description} onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>LT padrão</Label>
            <Input type="number" min={0} value={product.lt} onChange={(e) => setProduct((p) => ({ ...p, lt: e.target.value }))} />
          </div>
          <div className="flex items-end md:col-span-2">
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </div>
        </form>
        <div className="max-h-80 divide-y overflow-y-auto">
          {(products ?? []).map((p) => (
            <div key={p.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">{p.code}</span>
              <span className="truncate px-3 text-muted-foreground">{p.description}</span>
              <span className="text-muted-foreground">{p.default_lead_time ? `${p.default_lead_time} dias` : "—"}</span>
            </div>
          ))}
          {(products ?? []).length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card shadow-panel">
        <div className="border-b px-4 py-3">
          <h2 className="font-display text-base font-semibold">Unidades de medida</h2>
        </div>
        <form onSubmit={addUnit} className="grid gap-3 border-b p-4 md:grid-cols-12">
          <div className="space-y-1.5 md:col-span-3">
            <Label>Sigla</Label>
            <Input required value={unit.code} onChange={(e) => setUnit((u) => ({ ...u, code: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-7">
            <Label>Descrição</Label>
            <Input value={unit.description} onChange={(e) => setUnit((u) => ({ ...u, description: e.target.value }))} />
          </div>
          <div className="flex items-end md:col-span-2">
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </div>
        </form>
        <div className="divide-y">
          {(units ?? []).map((u) => (
            <div key={u.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">{u.code}</span>
              <span className="truncate px-3 text-muted-foreground">{u.description}</span>
            </div>
          ))}
        </div>
      </section>


      <section className="rounded-lg border bg-card p-4 shadow-panel">
        <h2 className="font-display text-base font-semibold">Parâmetros</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Alertar itens parados há mais de (dias)</Label>
            <Input
              type="number"
              min={1}
              className="w-40"
              defaultValue={settings?.stale_days ?? 3}
              onBlur={(e) => saveStaleDays(Number(e.target.value))}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Itens parados acima deste limite aparecem destacados em vermelho nas filas e no dashboard.
          </p>
        </div>
      </section>
    </div>
  );
}
