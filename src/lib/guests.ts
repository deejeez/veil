import { supabase } from './supabase'
import type { Guest } from '../types/database'

export async function getGuestsForCouple(coupleId: string): Promise<Guest[]> {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
  const { data, error } = await supabase
    .from('guests')
    .insert(guest)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGuest(id: string): Promise<void> {
  const { error } = await supabase.from('guests').delete().eq('id', id)
  if (error) throw error
}
