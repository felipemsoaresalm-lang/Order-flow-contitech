ALTER TABLE public.orders ADD COLUMN cs_owner_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_orders_cs_owner ON public.orders(cs_owner_id);