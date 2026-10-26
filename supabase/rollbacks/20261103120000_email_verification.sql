-- Rollback for 20261103120000_email_verification.sql
DROP FUNCTION IF EXISTS public.mark_email_verified();
DROP FUNCTION IF EXISTS public.my_email_verified();
DROP TABLE IF EXISTS public.email_verifications;
