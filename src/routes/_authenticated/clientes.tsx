import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | Pré-Entrada de Pedidos" },
      {
        name: "description",
        content:
          "Cadastro de clientes com CNPJ, código SAP, razão social, key account, endereço, contatos e condições comerciais.",
      },
      { property: "og:title", content: "Clientes | Pré-Entrada de Pedidos" },
      { property: "og:description", content: "Cadastro completo de clientes e unidades." },
    ],
  }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  cnpj: string | null;
  sales_org: string | null;
  segment: string | null;
  sap_code: string | null;
  company_name: string;
  key_account: string | null;
  customer: string | null;
  business_location: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  destination: string | null;
  zip_code: string | null;
  phone: string | null;
  contact_email: string | null;
  state_registration: string | null;
  incoterms: string | null;
  payment_terms: string | null;
  xml_email: string | null;
  notes: string | null;
  customer_since: string | null;
  last_credit_check: string | null;
  credit_limit: string | null;
  distribution_channel: string | null;
  package: string | null;
};

const FIELDS: { key: keyof Customer; label: string; textarea?: boolean }[] = [
  { key: "company_name", label: "Razão Social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "sap_code", label: "Código SAP HANA" },
  { key: "sales_org", label: "Organização de Vendas" },
  { key: "segment", label: "Segmento" },
  { key: "key_account", label: "Key Account" },
  { key: "customer", label: "Customer" },
  { key: "business_location", label: "Business Location" },
  { key: "address", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "region", label: "Região" },
  { key: "destination", label: "Destino" },
  { key: "zip_code", label: "CEP" },
  { key: "phone", label: "Telefone" },
  { key: "contact_email", label: "E-mail contato" },
  { key: "state_registration", label: "Inscrição Estadual" },
  { key: "incoterms", label: "Incoterms" },
  { key: "payment_terms", label: "Condição Pgto" },
  { key: "xml_email", label: "E-mail XML" },
  { key: "customer_since", label: "Cliente desde" },
  { key: "last_credit_check", label: "Últ. verificação de limite" },
  { key: "credit_limit", label: "Limite de crédito" },
  { key: "distribution_channel", label: "Distribution Channel" },
  { key: "package", label: "Package" },
  { key: "notes", label: "Observações", textarea: true },
];

const emptyForm = () =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<string, string>;

function CustomersPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("vendas", "customer_service", "admin");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [state, setState] = useState("todos");
  const [segment, setSegment] = useState("todos");
  const [salesOrg, setSalesOrg] = useState("todos");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("company_name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const customers = data ?? [];

  const options = useMemo(() => {
    const uniq = (key: keyof Customer) =>
      Array.from(new Set(customers.map((c) => (c[key] ?? "").toString().trim()).filter(Boolean))).sort();
    return {
      states: uniq("state"),
      segments: uniq("segment"),
      salesOrgs: uniq("sales_org"),
    };
  }, [customers]);

  const rows = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      [c.company_name, c.cnpj, c.sap_code, c.customer, c.business_location, c.city, c.key_account]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    return (
      matchSearch &&
      (state === "todos" || c.state === state) &&
      (segment === "todos" || c.segment === segment) &&
      (salesOrg === "todos" || c.sales_org === salesOrg)
    );
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        FIELDS.map((f) => {
          const v = (form[f.key as string] ?? "").trim();
          return [f.key, v ? v : null];
        }),
      ) as Record<string, string | null>;
      payload["company_name"] = payload["company_name"] ?? "";
      if (editingId) {
        const { error } = await supabase.from("customers").update(payload as never).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Cliente atualizado." : "Cliente cadastrado.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm(
      Object.fromEntries(FIELDS.map((f) => [f.key, (c[f.key] ?? "").toString()])) as Record<string, string>,
    );
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="text-sm text-muted-foreground">{rows.length} cliente(s) listado(s).</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="size-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key as string} className={cn("space-y-1.5", f.textarea && "sm:col-span-2")}>
                    <Label htmlFor={f.key as string}>{f.label}</Label>
                    {f.textarea ? (
                      <Textarea
                        id={f.key as string}
                        value={form[f.key as string] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key as string]: e.target.value })}
                      />
                    ) : (
                      <Input
                        id={f.key as string}
                        value={form[f.key as string] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key as string]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !form["company_name"]?.trim()}
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="Buscar por razão social, CNPJ, código SAP, cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={salesOrg} onValueChange={setSalesOrg}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as orgs. de vendas</SelectItem>
            {options.salesOrgs.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os segmentos</SelectItem>
            {options.segments.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            {options.states.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Razão Social</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Cód. SAP</th>
              <th className="px-4 py-3">Business Location</th>
              <th className="px-4 py-3">Cidade / UF</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Key Account</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const isOpen = !!expanded[c.id];
              return (
                <Fragment key={c.id}>
                  <tr
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        {c.company_name || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.cnpj ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.sap_code ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.business_location ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.city, c.state].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.segment ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.key_account ?? "—"}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-muted/20 px-4 py-4">
                        <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                          {FIELDS.filter((f) => !["company_name", "cnpj", "sap_code"].includes(f.key as string)).map(
                            (f) => (
                              <div key={f.key as string}>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
                                <p className="mt-0.5 break-words">{(c[f.key] ?? "—") as string}</p>
                              </div>
                            ),
                          )}
                        </div>
                        {canEdit && (
                          <div className="mt-4">
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              Editar cliente
                            </Button>
                          </div>
                        )}
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
  );
}
