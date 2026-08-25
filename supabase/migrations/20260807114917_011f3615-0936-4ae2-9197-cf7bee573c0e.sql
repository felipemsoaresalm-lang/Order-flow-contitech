
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('vendas','customer_service','engenharia','planejamento','admin');
CREATE TYPE public.order_status AS ENUM ('aberto','em_processamento','aguardando_engenharia','aguardando_planejamento','confirmado','cancelado');
CREATE TYPE public.item_status AS ENUM ('novo','aguardando_codigo','codigo_recebido','aguardando_data','confirmado','cancelado');
CREATE TYPE public.request_status AS ENUM ('pendente','respondida');

-- COMMON TRIGGER FN
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE POLICY "user_roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PROFILE AUTOCREATION + FIRST USER ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;

  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'vendas');
  EXCEPTION WHEN others THEN
    _role := 'vendas';
  END;

  IF _is_first THEN _role := 'admin'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  default_lead_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_manage" ON public.products FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engenharia','customer_service']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','engenharia','customer_service']::public.app_role[]));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDERS
CREATE SEQUENCE public.order_number_seq START 1000;
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('PED-' || lpad(nextval('public.order_number_seq')::text, 5, '0')),
  customer_name TEXT NOT NULL,
  salesperson_id UUID NOT NULL REFERENCES auth.users(id),
  status public.order_status NOT NULL DEFAULT 'aberto',
  sap_number TEXT,
  sap_inserted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_all" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = salesperson_id AND public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin']::public.app_role[]));
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin','engenharia','planejamento']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin','engenharia','planejamento']::public.app_role[]));
CREATE POLICY "orders_delete_admin" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_code TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  requested_delivery_date DATE,
  confirmed_delivery_date DATE,
  lead_time INTEGER,
  routing TEXT,
  status public.item_status NOT NULL DEFAULT 'novo',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_all" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin']::public.app_role[]));
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin','engenharia','planejamento']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin','engenharia','planejamento']::public.app_role[]));
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin']::public.app_role[]));
CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BUSINESS RULE: item só confirmado com código e data
CREATE OR REPLACE FUNCTION public.validate_item_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmado' AND (NEW.product_code IS NULL OR NEW.product_code = '' OR NEW.confirmed_delivery_date IS NULL) THEN
    RAISE EXCEPTION 'Item nao pode ser confirmado sem codigo de produto e data de entrega';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
    IF NEW.status = 'confirmado' THEN NEW.confirmed_at = now(); END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_validate_item BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_item_confirmation();

-- ENGINEERING REQUESTS
CREATE TABLE public.engineering_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id),
  product_code TEXT,
  lead_time INTEGER,
  routing TEXT,
  status public.request_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineering_requests TO authenticated;
GRANT ALL ON public.engineering_requests TO service_role;
ALTER TABLE public.engineering_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eng_select_all" ON public.engineering_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng_insert" ON public.engineering_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin']::public.app_role[]));
CREATE POLICY "eng_update" ON public.engineering_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['engenharia','admin','customer_service']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','admin','customer_service']::public.app_role[]));
CREATE TRIGGER trg_eng_updated BEFORE UPDATE ON public.engineering_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLANNING REQUESTS
CREATE TABLE public.planning_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id),
  delivery_date DATE,
  status public.request_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_requests TO authenticated;
GRANT ALL ON public.planning_requests TO service_role;
ALTER TABLE public.planning_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_select_all" ON public.planning_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_insert" ON public.planning_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','admin','engenharia']::public.app_role[]));
CREATE POLICY "plan_update" ON public.planning_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['planejamento','admin','customer_service']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['planejamento','admin','customer_service']::public.app_role[]));
CREATE TRIGGER trg_plan_updated BEFORE UPDATE ON public.planning_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STATUS LOG
CREATE TABLE public.item_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  from_status public.item_status,
  to_status public.item_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.item_status_logs TO authenticated;
GRANT ALL ON public.item_status_logs TO service_role;
ALTER TABLE public.item_status_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_select_all" ON public.item_status_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert" ON public.item_status_logs FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role public.app_role,
  title TEXT NOT NULL,
  body TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)));
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)))
  WITH CHECK (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)));

-- SETTINGS
CREATE TABLE public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  stale_days INTEGER NOT NULL DEFAULT 3,
  allow_partial_confirmation BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (id) VALUES (true);

CREATE INDEX idx_items_order ON public.order_items(order_id);
CREATE INDEX idx_eng_status ON public.engineering_requests(status);
CREATE INDEX idx_plan_status ON public.planning_requests(status);
