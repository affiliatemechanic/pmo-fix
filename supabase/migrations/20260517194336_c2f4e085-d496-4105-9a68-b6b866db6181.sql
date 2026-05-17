
CREATE TABLE IF NOT EXISTS public.fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'internal_product',
  summary text NOT NULL,
  description text,
  url text,
  categories text[],
  platforms text[],
  tags text[],
  price_note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY fixes_select_active ON public.fixes
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE POLICY fixes_admin_all ON public.fixes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER fixes_set_updated_at
  BEFORE UPDATE ON public.fixes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pmo_submissions
  ADD COLUMN IF NOT EXISTS match_result jsonb,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;
