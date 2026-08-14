import { supabase } from './supabase'
import { type Couple } from '../types/database'

export async function getCoupleForUser(userId: string): Promise<Couple | null> {
  // Check as primary
  const { data: primary } = await supabase
    .from('couples')
    .select('*')
    .eq('user_id_primary', userId)
    .maybeSingle()
  if (primary) return primary as Couple

  // Check as partner
  const { data: partner } = await supabase
    .from('couples')
    .select('*')
    .eq('user_id_partner', userId)
    .maybeSingle()
  if (partner) return partner as Couple | null

  // Not linked by id yet — but they may have been invited. Relying on the
  // /accept-invite link alone meant an invited partner who signed in any other
  // way (link expired, signed up directly, opened the app on another device)
  // stayed unlinked and hit the paywall, since nothing recorded that their
  // couple had already paid. RLS only exposes a row here when the invited
  // address matches this user's own verified email and nobody has claimed it.
  return claimPendingInvite(userId)
}

async function claimPendingInvite(userId: string): Promise<Couple | null> {
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) return null

  const { data: invited } = await supabase
    .from('couples')
    .select('*')
    .ilike('email_partner', email)
    .is('user_id_partner', null)
    .maybeSingle()
  if (!invited) return null

  const { data: claimed } = await supabase
    .from('couples')
    .update({ user_id_partner: userId })
    .eq('id', (invited as Couple).id)
    .is('user_id_partner', null)   // lose the race rather than overwrite
    .select('*')
    .maybeSingle()

  return (claimed ?? invited) as Couple
}

export async function updateCouple(coupleId: string, updates: Partial<Couple>) {
  const { error } = await supabase
    .from('couples')
    .update(updates)
    .eq('id', coupleId)
  if (error) throw error
}
