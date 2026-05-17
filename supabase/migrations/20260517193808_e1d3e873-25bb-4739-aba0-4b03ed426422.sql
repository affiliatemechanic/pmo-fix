
ALTER TABLE public.pmo_submissions
  ADD COLUMN IF NOT EXISTS platforms text[],
  ADD COLUMN IF NOT EXISTS platforms_other text,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS cost_impact text,
  ADD COLUMN IF NOT EXISTS dream_fix text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS work_type text;

DROP POLICY IF EXISTS submissions_insert_anyone ON public.pmo_submissions;
CREATE POLICY submissions_insert_anyone
ON public.pmo_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(description) >= 5 AND length(description) <= 5000
  AND (category IS NULL OR length(category) <= 100)
  AND email IS NOT NULL
  AND length(email) >= 5 AND length(email) <= 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (user_id IS NULL OR user_id = auth.uid())
  AND (platforms IS NULL OR array_length(platforms, 1) <= 30)
  AND (platforms_other IS NULL OR length(platforms_other) <= 500)
  AND (frequency IS NULL OR length(frequency) <= 50)
  AND (cost_impact IS NULL OR length(cost_impact) <= 50)
  AND (dream_fix IS NULL OR length(dream_fix) <= 5000)
  AND (first_name IS NULL OR length(first_name) <= 100)
  AND (work_type IS NULL OR length(work_type) <= 100)
);
