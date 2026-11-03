-- Drop existing policies if any
DROP POLICY IF EXISTS "support_messages_policy" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can view own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_policy_public" ON public.support_messages;

-- Create permissive policy for authenticated users
CREATE POLICY "support_messages_policy_authenticated" ON public.support_messages
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE support_tickets.ticket_id = support_messages.ticket_id
    AND (support_tickets.user_id = auth.uid())
  )
  OR auth.role() = 'service_role'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE support_tickets.ticket_id = support_messages.ticket_id
    AND (support_tickets.user_id = auth.uid())
  )
  OR auth.role() = 'service_role'
);

-- Create permissive policy for public/anon
CREATE POLICY "support_messages_policy_public" ON public.support_messages
AS PERMISSIVE
FOR ALL
TO public
USING (true)
WITH CHECK (true);
