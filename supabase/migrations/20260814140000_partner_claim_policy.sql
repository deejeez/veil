-- Let an invited partner link themselves to the couple that invited them.
--
-- The only UPDATE policy on couples was:
--   auth.uid() = user_id_primary OR auth.uid() = user_id_partner
--
-- An invited partner is neither of those yet — user_id_partner is still null —
-- so their claim matched zero rows. PostgREST doesn't treat a zero-row update
-- as an error, so /accept-invite reported "You're in", redirected, and left the
-- partner unlinked. They then hit the paywall, because with no couple there was
-- nothing recording that the couple had already paid.
--
-- Narrow by construction: only an unclaimed row, only where the invited address
-- matches the caller's own verified email, and only to set themselves.

CREATE POLICY "invited partner can claim their couple"
  ON couples FOR UPDATE
  USING (
    user_id_partner IS NULL
    AND email_partner IS NOT NULL
    AND lower(email_partner) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    user_id_partner = auth.uid()
    AND lower(email_partner) = lower(auth.jwt() ->> 'email')
  );

-- Reading is also required before the claim: getCoupleForUser looks the couple
-- up by user id, which won't match until the claim succeeds. Without this the
-- partner can't discover the invitation they were sent.
CREATE POLICY "invited partner can see the couple that invited them"
  ON couples FOR SELECT
  USING (
    user_id_partner IS NULL
    AND email_partner IS NOT NULL
    AND lower(email_partner) = lower(auth.jwt() ->> 'email')
  );
