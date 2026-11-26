-- Rollback for 20261125130000_mentor_earnings_hold.sql: earnings credit on payment again (pending → accrued).
-- Reversed rows and negative adjustments are kept (they record real cancellations/refunds).
SELECT cron.unschedule('release-due-earnings') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-due-earnings');
DROP TRIGGER IF EXISTS trg_hold_new_earning ON public.mentor_earnings;
DROP TRIGGER IF EXISTS trg_sync_session_earnings ON public.sessions;
DROP TRIGGER IF EXISTS trg_sync_event_earnings ON public.events_programs;
DROP TRIGGER IF EXISTS trg_sync_refund_earnings ON public.payments;
DROP FUNCTION IF EXISTS public.hold_new_earning();
DROP FUNCTION IF EXISTS public.sync_session_earnings();
DROP FUNCTION IF EXISTS public.sync_event_earnings();
DROP FUNCTION IF EXISTS public.sync_refund_earnings();
DROP FUNCTION IF EXISTS public.release_due_earnings();
DROP FUNCTION IF EXISTS public.reverse_earnings(uuid[], text[]);
DROP FUNCTION IF EXISTS public.earning_state(text, uuid);
DROP FUNCTION IF EXISTS public.earning_event(uuid);
DROP FUNCTION IF EXISTS public.earnings_auto_release_days();
UPDATE public.mentor_earnings SET status = 'accrued' WHERE status = 'pending';
ALTER TABLE public.mentor_earnings DROP CONSTRAINT IF EXISTS mentor_earnings_status_check;
ALTER TABLE public.mentor_earnings ADD CONSTRAINT mentor_earnings_status_check CHECK (status IN ('accrued', 'withdrawn', 'reversed'));
DROP INDEX IF EXISTS public.idx_earnings_reference;
