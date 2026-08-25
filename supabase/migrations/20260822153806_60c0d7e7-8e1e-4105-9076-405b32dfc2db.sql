ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tax_category text NOT NULL DEFAULT 'industrializacao',
  ADD COLUMN IF NOT EXISTS icms_rate numeric NOT NULL DEFAULT 0.18;