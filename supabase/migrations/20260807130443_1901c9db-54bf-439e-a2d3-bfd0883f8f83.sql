CREATE TABLE public.units_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units_of_measure TO authenticated;
GRANT ALL ON public.units_of_measure TO service_role;

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY uom_select_all ON public.units_of_measure FOR SELECT TO authenticated USING (true);
CREATE POLICY uom_manage ON public.units_of_measure FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'customer_service'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'customer_service'::app_role]));

CREATE TRIGGER trg_uom_updated BEFORE UPDATE ON public.units_of_measure
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.units_of_measure (code, description, sort_order) VALUES
  ('M', 'Metro', 1),
  ('PC', 'Peça', 2),
  ('KG', 'Quilograma', 3);

ALTER TABLE public.order_items
  ADD COLUMN unit_of_measure text NOT NULL DEFAULT 'M',
  ADD COLUMN units_count numeric NOT NULL DEFAULT 1,
  ADD COLUMN qty_per_unit numeric NOT NULL DEFAULT 1;