import { supabase } from './supabase'
import type { Task } from '../types/database'

export async function getTasksForCouple(coupleId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Task[]
}

export async function insertTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function toggleTask(taskId: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', taskId)
  if (error) throw error
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
  if (error) throw error
}

export async function updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'couple_id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
  if (error) throw error
}
