import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  Truck,
  Headset,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { roleLabels, formatDateTime, type AppRole } from "@/lib/domain";
import { markNotificationRead } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["vendas", "customer_service", "engenharia", "planejamento", "admin"] },
  { to: "/dashboards", label: "Dashboards", icon: BarChart3, roles: ["vendas", "customer_service", "engenharia", "planejamento", "admin"] },
  { to: "/acompanhamento", label: "Acompanhamento", icon: CalendarClock, roles: ["vendas", "customer_service", "engenharia", "planejamento", "admin"] },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["vendas", "customer_service", "engenharia", "planejamento", "admin"] },
  { to: "/pedidos/novo", label: "Novo pedido", icon: PackagePlus, roles: ["vendas", "customer_service", "admin"] },
  { to: "/clientes", label: "Clientes", icon: Building2, roles: ["vendas", "customer_service", "engenharia", "planejamento", "admin"] },
  { to: "/customer-service", label: "Fila Customer Service", icon: Headset, roles: ["customer_service", "admin"] },
  { to: "/engenharia", label: "Fila Engenharia", icon: Factory, roles: ["engenharia", "admin"] },
  { to: "/planejamento", label: "Fila Planejamento", icon: Truck, roles: ["planejamento", "admin"] },
  { to: "/admin", label: "Administração", icon: Settings, roles: ["admin"] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRole } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => hasRole(...item.roles)).map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, read_at, order_id")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const items = data ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="size-5" />
          {items.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notificações</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma notificação nova.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                await markNotificationRead(n.id);
                void queryClient.invalidateQueries({ queryKey: ["notifications"] });
              }}
              className="block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60"
            >
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { fullName, user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar p-4">
      <div className="mb-6 px-2">
        <p className="font-display text-lg font-bold text-sidebar-foreground">Pré-Entrada</p>
        <p className="text-xs text-sidebar-foreground/60">Gestão de pedidos</p>
      </div>
      <NavLinks onNavigate={() => setOpen(false)} />
      <div className="mt-auto rounded-md bg-sidebar-accent/60 p-3">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{fullName || user?.email}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">
          {roles.map((r) => roleLabels[r]).join(", ") || "Sem perfil"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/90 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              {sidebar}
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-1">
            <Notifications />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
