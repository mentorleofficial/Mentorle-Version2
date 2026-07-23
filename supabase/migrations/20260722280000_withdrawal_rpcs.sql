-- Withdrawals: atomic RPCs. A mentor withdraws their full accrued balance in one request
-- (the accrued earnings are marked 'withdrawn' and linked to the request); admins mark it
-- paid (manual transfer + reference) or reject it (which reverts the earnings to accrued).

-- Mentor requests a payout of their entire accrued balance.
CREATE OR REPLACE FUNCTION public.request_withdrawal()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _mentor uuid := auth.uid();
  _amount numeric;
  _acct   jsonb;
  _req_id uuid;
BEGIN
  IF _mentor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  -- Lock this mentor's accrued earnings so two concurrent requests can't double-withdraw.
  PERFORM 1 FROM public.mentor_earnings
    WHERE mentor_id = _mentor AND status = 'accrued' FOR UPDATE;

  SELECT COALESCE(sum(net_amount), 0) INTO _amount
    FROM public.mentor_earnings WHERE mentor_id = _mentor AND status = 'accrued';
  IF _amount <= 0 THEN RAISE EXCEPTION 'NO_BALANCE'; END IF;

  SELECT details INTO _acct FROM public.mentor_payout_accounts WHERE mentor_id = _mentor;
  IF _acct IS NULL THEN RAISE EXCEPTION 'NO_PAYOUT_ACCOUNT'; END IF;

  INSERT INTO public.withdrawal_requests (mentor_id, amount, status, payout_account_snapshot, requested_at)
    VALUES (_mentor, _amount, 'requested', _acct, now())
    RETURNING id INTO _req_id;

  UPDATE public.mentor_earnings
    SET status = 'withdrawn', withdrawal_request_id = _req_id
    WHERE mentor_id = _mentor AND status = 'accrued';

  RETURN _req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal() TO authenticated;

-- Admin marks a withdrawal paid or rejected. Reject reverts the linked earnings to accrued.
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  _request_id uuid,
  _action     text,
  _reference  text DEFAULT NULL,
  _note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin'::app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF _action = 'paid' THEN
    UPDATE public.withdrawal_requests
      SET status = 'paid', payment_reference = _reference, admin_note = _note,
          processed_at = now(), processed_by = _caller
      WHERE id = _request_id AND status IN ('requested', 'approved');
  ELSIF _action = 'rejected' THEN
    UPDATE public.withdrawal_requests
      SET status = 'rejected', admin_note = _note, processed_at = now(), processed_by = _caller
      WHERE id = _request_id AND status IN ('requested', 'approved');
    UPDATE public.mentor_earnings
      SET status = 'accrued', withdrawal_request_id = NULL
      WHERE withdrawal_request_id = _request_id;
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_withdrawal(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text, text) TO authenticated;
