ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS sidebar_background text NOT NULL DEFAULT '220 25% 10%',
  ADD COLUMN IF NOT EXISTS sidebar_foreground text NOT NULL DEFAULT '40 33% 96%',
  ADD COLUMN IF NOT EXISTS sidebar_primary text NOT NULL DEFAULT '199 89% 48%',
  ADD COLUMN IF NOT EXISTS body_font text NOT NULL DEFAULT 'DM Sans',
  ADD COLUMN IF NOT EXISTS heading_font text NOT NULL DEFAULT 'DM Serif Display';