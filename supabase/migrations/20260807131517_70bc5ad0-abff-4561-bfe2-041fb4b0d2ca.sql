ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attachments TO authenticated;
GRANT ALL ON public.order_attachments TO service_role;

ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attach_select_all ON public.order_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY attach_insert ON public.order_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['vendas','customer_service','engenharia','planejamento','admin']::public.app_role[]));
CREATE POLICY attach_delete ON public.order_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_order_attachments_order ON public.order_attachments(order_id);