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
  return partner as Couple | null
}

export async function updateCouple(coupleId: string, updates: Partial<Couple>) {
  const { error } = await supabase
    .from('couples')
    .update(updates)
    .eq('id', coupleId)
  if (error) throw error
}
