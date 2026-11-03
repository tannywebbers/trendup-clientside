-- Fix Paystack idempotency + allow Paystack reference strings

-- 1) Ensure transactions.reference_id can store Paystack refs
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='transactions' AND column_name='reference_id';

  IF current_type IS NULL THEN
    RAISE EXCEPTION 'transactions.reference_id column not found';
  END IF;

  IF current_type <> 'text' THEN
    ALTER TABLE public.transactions
      ALTER COLUMN reference_id TYPE text
      USING reference_id::text;
  END IF;
END $$;

-- 2) Add unique constraint for idempotency (NULLs are allowed multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_reference_id_key'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_reference_id_key UNIQUE (reference_id);
  END IF;
END $$;

-- 3) Atomic crediting: log transaction once, then credit points, then notify
CREATE OR REPLACE FUNCTION public.credit_purchase_points(
  _user_id uuid,
  _points integer,
  _amount_paid numeric,
  _reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_tx_id uuid;
  new_balance integer;
BEGIN
  IF _user_id IS NULL OR _reference IS NULL OR length(trim(_reference)) = 0 THEN
    RAISE EXCEPTION 'Missing user_id or reference';
  END IF;

  IF _points IS NULL OR _points <= 0 THEN
    RAISE EXCEPTION 'Invalid points';
  END IF;

  -- Insert transaction first; if already present, treat as already processed
  INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
  VALUES (
    _user_id,
    _points,
    'purchase',
    format('Purchased %s TikPoints for ₦%s', _points, _amount_paid),
    _reference
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  UPDATE public.profiles
  SET tik_points = tik_points + _points
  WHERE user_id = _user_id
  RETURNING tik_points INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user_id %', _user_id;
  END IF;

  -- Notification type must satisfy existing CHECK constraint
  INSERT INTO public.notifications (user_id, type, title, message, reference_id)
  VALUES (
    _user_id,
    'points_earned',
    'Points Purchased!',
    format('You successfully purchased %s TikPoints.', _points),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'transaction_id', inserted_tx_id,
    'new_balance', new_balance
  );
END;
$$;

-- Only backend should be able to call this RPC
REVOKE EXECUTE ON FUNCTION public.credit_purchase_points(uuid, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_purchase_points(uuid, integer, numeric, text) TO service_role;

-- 4) Enable realtime inserts for notifications (for live dropdown updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
