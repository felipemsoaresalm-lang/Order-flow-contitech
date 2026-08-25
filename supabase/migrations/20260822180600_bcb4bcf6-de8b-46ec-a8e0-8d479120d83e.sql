CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text,
  sales_org text,
  segment text,
  sap_code text,
  company_name text NOT NULL DEFAULT '',
  key_account text,
  customer text,
  business_location text,
  address text,
  city text,
  state text,
  region text,
  destination text,
  zip_code text,
  phone text,
  contact_email text,
  state_registration text,
  incoterms text,
  payment_terms text,
  xml_email text,
  notes text,
  customer_since text,
  last_credit_check text,
  credit_limit text,
  distribution_channel text,
  package text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_all ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['vendas'::app_role,'customer_service'::app_role,'admin'::app_role]));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['vendas'::app_role,'customer_service'::app_role,'admin'::app_role])) WITH CHECK (has_any_role(auth.uid(), ARRAY['vendas'::app_role,'customer_service'::app_role,'admin'::app_role]));
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['customer_service'::app_role,'admin'::app_role]));

CREATE INDEX customers_company_name_idx ON public.customers (company_name);
CREATE INDEX customers_sap_code_idx ON public.customers (sap_code);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();