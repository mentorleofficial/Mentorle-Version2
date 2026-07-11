-- Migration to add site_url column to public.branding table
ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS site_url text NOT NULL DEFAULT 'https://mentorle.vercel.app/';
