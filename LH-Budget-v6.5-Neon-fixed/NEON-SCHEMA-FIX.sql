-- Kør én gang i Neon SQL Editor efter import af CSV-data.
-- Giver nye rækker automatisk UUID og gør month_settings.upsert kompatibel.
ALTER TABLE public.budget_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.month_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.custom_budgets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.custom_budget_sections ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.custom_budget_items ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS month_settings_user_month_unique
ON public.month_settings (user_id, month_key);
