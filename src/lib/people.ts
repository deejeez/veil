import { supabase } from './supabase'
import type { Person } from '../types/database'

export async function getPeopleForCouple(coupleId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('couple_id', coupleId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Person[]
}

export async function addPerson(coupleId: string, name: string): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .insert({ couple_id: coupleId, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data as Person
}

export async function renamePerson(personId: string, name: string): Promise<void> {
  const { error } = await supabase.from('people').update({ name: name.trim() }).eq('id', personId)
  if (error) throw error
}

export async function deletePerson(personId: string): Promise<void> {
  const { error } = await supabase.from('people').delete().eq('id', personId)
  if (error) throw error
}

/**
 * Everyone a task can be assigned to: the shared option, each partner, then
 * the couple's named helpers.
 *
 * Assignment stores a name string rather than a person id — the column predates
 * this table, and existing rows hold plain names. Keeping it a string means the
 * backfill needed no data rewrite, and removing a person leaves their old tasks
 * readable rather than blanking them.
 */
export function assigneeOptions(
  namePrimary: string | null | undefined,
  namePartner: string | null | undefined,
  people: Person[],
): { value: string; label: string }[] {
  const opts = [{ value: 'couple', label: 'Both of us' }]
  if (namePrimary?.trim()) opts.push({ value: namePrimary.trim(), label: namePrimary.trim() })
  if (namePartner?.trim()) opts.push({ value: namePartner.trim(), label: namePartner.trim() })
  for (const p of people) {
    if (!opts.some(o => o.value === p.name)) opts.push({ value: p.name, label: p.name })
  }
  return opts
}
