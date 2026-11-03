-- Add unique constraint on reference_id for transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_reference_id_unique'
  ) THEN
    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_reference_id_unique UNIQUE (reference_id);
  END IF;
END $$;