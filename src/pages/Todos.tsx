import { useEffect, useState, useRef, type CSSProperties } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getTasksForCouple, insertTask, toggleTask, deleteTask, updateTask } from '../lib/tasks'
import { getVendorsForCouple } from '../lib/vendors'
import { getGuestsForCouple } from '../lib/guests'
import { getBudgetCategories } from '../lib/budget'
import { deriveTimelineStatus, getCurrentPhaseId, type MilestoneCompletion } from '../lib/deriveTimelineStatus'
import type { Couple, Task } from '../types/database'

const TASK_CATEGORIES = ['ceremony', 'venue', 'catering', 'vendors', 'guests', 'attire', 'decor', 'admin', 'honeymoon', 'other']



type Filter = 'pending' | 'completed' | 'all'

export default function Todos() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<Filter>('pending')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: 'couple',
    category: '',
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ title: '', due_date: '', assigned_to: '', category: '' })
  const [editSaving, setEditSaving] = useState(false)
  const editTitleRef = useRef<HTMLInputElement>(null)

  // Derived from the same milestones as the Timeline page and the right panel,
  // so the "coming up" preview can't drift from them or suggest work already
  // done. Loaded only when the pending list is actually empty — three extra
  // queries aren't worth paying on every visit for a preview most couples
  // never see.
  const [upcomingMilestones, setUpcomingMilestones] = useState<string[] | null>(null)

  const inputStyle: CSSProperties = { display: 'block' }

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const t = await getTasksForCouple(c.id)
      setTasks(t)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAddTask() {
    if (!couple || !newTask.title.trim()) return
    setSaving(true)
    try {
      const task = await insertTask({
        couple_id: couple.id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        due_date: newTask.due_date || null,
        completed: false,
        assigned_to: newTask.assigned_to || 'couple',
        category: newTask.category || null,
      })
      setTasks(prev => [task, ...prev])
      setShowAddForm(false)
      setNewTask({ title: '', description: '', due_date: '', assigned_to: 'couple', category: '' })
    } catch {
      alert('Failed to add task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(taskId: string, completed: boolean) {
    try {
      await toggleTask(taskId, completed)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t))
    } catch {
      alert('Failed to update task. Please try again.')
    }
  }

  async function handleDelete(taskId: string) {
    try {
      await deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {
      alert('Failed to delete task. Please try again.')
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditDraft({
      title: task.title,
      due_date: task.due_date ?? '',
      assigned_to: task.assigned_to ?? 'couple',
      category: task.category ?? '',
    })
    setTimeout(() => editTitleRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(taskId: string) {
    if (!editDraft.title.trim()) return
    setEditSaving(true)
    try {
      await updateTask(taskId, {
        title: editDraft.title.trim(),
        due_date: editDraft.due_date || null,
        assigned_to: editDraft.assigned_to || 'couple',
        category: editDraft.category || null,
      })
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t, title: editDraft.title.trim(), due_date: editDraft.due_date || null, assigned_to: editDraft.assigned_to || 'couple', category: editDraft.category || null }
        : t
      ))
      setEditingId(null)
    } catch {
      alert('Failed to save. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  const pendingCount = tasks.filter(t => !t.completed).length
  const overdueCount = tasks.filter(t => !t.completed && t.due_date && t.due_date < today).length

  // Only fetch once we know the preview will actually render.
  const showTimelinePreview = !loading && filter === 'pending' && filtered.length === 0
  useEffect(() => {
    if (!showTimelinePreview || !couple || upcomingMilestones !== null) return
    let cancelled = false
    async function loadUpcoming(c: Couple) {
      const [vendors, guests, budgetCats, comps] = await Promise.all([
        getVendorsForCouple(c.id),
        getGuestsForCouple(c.id).catch(() => []),
        getBudgetCategories(c.id).catch(() => []),
        supabase.from('milestone_completions').select('milestone_key, completed_at').eq('couple_id', c.id),
      ])
      const phases = deriveTimelineStatus(c, vendors, guests, budgetCats, (comps.data ?? []) as MilestoneCompletion[])
      const startIdx = c.wedding_date
        ? Math.max(0, phases.findIndex(p => p.id === getCurrentPhaseId(new Date(`${c.wedding_date}T00:00:00`))))
        : 0
      const next: string[] = []
      for (let i = startIdx; i < phases.length && next.length < 3; i++) {
        for (const m of phases[i].milestones) {
          if (m.status === 'done') continue
          next.push(m.task)
          if (next.length === 3) break
        }
      }
      if (!cancelled) setUpcomingMilestones(next)
    }
    loadUpcoming(couple)
    return () => { cancelled = true }
  }, [showTimelinePreview, couple, upcomingMilestones])

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, marginBottom: '6px' }}>
        Tasks
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        {pendingCount} remaining{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
      </p>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['pending', 'completed', 'all'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 18px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: filter === f ? 600 : 400,
            background: filter === f ? 'rgba(184,146,106,0.10)' : 'transparent',
            border: filter === f ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
            borderRadius: '8px',
            color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}>
            {f === 'pending' ? `Pending (${pendingCount})` : f === 'completed' ? 'Completed' : 'All'}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 && (
        filter === 'pending' ? (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
              {upcomingMilestones === null
                ? 'Nothing due right now.'
                : upcomingMilestones.length > 0
                  ? 'Nothing due right now. Coming up on your timeline:'
                  : "Nothing due right now — and you're ahead on your timeline too."}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(upcomingMilestones ?? []).map((task, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)' }}>{task}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            No tasks here yet.
          </p>
        )
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
        {filtered.map(task => {
          const isOverdue = !task.completed && task.due_date && task.due_date < today
          const isEditing = editingId === task.id

          if (isEditing) {
            return (
              <div
                key={task.id}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'rgba(184,146,106,0.04)',
                  borderRadius: '8px',
                  marginBottom: '2px',
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]" style={{ marginBottom: '8px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <input
                      ref={editTitleRef}
                      value={editDraft.title}
                      onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(task.id); if (e.key === 'Escape') cancelEdit() }}
                      style={{ display: 'block', width: '100%', fontWeight: 500 }}
                      placeholder="Task name"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Due Date</label>
                    <input type="date" value={editDraft.due_date} onChange={e => setEditDraft(d => ({ ...d, due_date: e.target.value }))} style={{ display: 'block', width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Assigned To</label>
                    <select value={editDraft.assigned_to} onChange={e => setEditDraft(d => ({ ...d, assigned_to: e.target.value }))} style={{ display: 'block', width: '100%' }}>
                      <option value="couple">Both of us</option>
                      {couple?.name_primary && <option value={couple.name_primary}>{couple.name_primary}</option>}
                      {couple?.name_partner && <option value={couple.name_partner}>{couple.name_partner}</option>}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Category</label>
                    <select value={editDraft.category} onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))} style={{ display: 'block', width: '100%' }}>
                      <option value="">— None —</option>
                      {TASK_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
                  <Button onClick={() => handleSaveEdit(task.id)} disabled={editSaving || !editDraft.title.trim()}>
                    {editSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-border)',
                opacity: task.completed ? 0.55 : 1,
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(task.id, !task.completed)}
                style={{
                  width: '20px', height: '20px', flexShrink: 0, marginTop: '1px',
                  borderRadius: '50%',
                  border: `2px solid ${task.completed ? 'var(--color-status-booked)' : 'var(--color-border)'}`,
                  background: task.completed ? 'var(--color-status-booked)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '10px', fontWeight: 700,
                  transition: 'all 0.15s',
                }}
              >
                {task.completed ? '✓' : ''}
              </button>

              {/* Content — click to edit */}
              <div
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => !task.completed && startEdit(task)}
                title={task.completed ? '' : 'Click to edit'}
              >
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 2px 0',
                  textDecoration: task.completed ? 'line-through' : 'none',
                }}>
                  {task.title}
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {task.due_date && (
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: '11px',
                      color: isOverdue ? '#C4785C' : 'var(--color-text-secondary)',
                      fontWeight: isOverdue ? 600 : 400,
                    }}>
                      {isOverdue ? '⚠ ' : ''}Due {task.due_date}
                    </span>
                  )}
                  {task.assigned_to && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)' }}>
                      {task.assigned_to === 'couple' ? 'Both' : task.assigned_to}
                    </span>
                  )}
                  {task.category && (
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: '10px',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-bg)',
                      padding: '2px 6px', borderRadius: '4px',
                    }}>
                      {task.category}
                    </span>
                  )}
                  {task.description && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {task.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(task.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-status-none)', flexShrink: 0, padding: '2px 4px' }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {/* Add task form */}
      {showAddForm ? (
        <Card style={{ marginTop: '8px' }}>
          <SectionLabel>New Task</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]" style={{ marginBottom: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Task</label>
              <input
                autoFocus
                placeholder="e.g. Book final venue walkthrough"
                value={newTask.title}
                onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))}
                style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Due Date</label>
              <input type="date" value={newTask.due_date} onChange={e => setNewTask(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Assigned To</label>
              <select value={newTask.assigned_to} onChange={e => setNewTask(f => ({ ...f, assigned_to: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                <option value="couple">Both of us</option>
                {couple?.name_primary && <option value={couple.name_primary}>{couple.name_primary}</option>}
                {couple?.name_partner && <option value={couple.name_partner}>{couple.name_partner}</option>}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Category</label>
              <select value={newTask.category} onChange={e => setNewTask(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                <option value="">— None —</option>
                {TASK_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Notes (optional)</label>
              <input placeholder="Any details..." value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={saving || !newTask.title.trim()}>
              {saving ? 'Saving...' : 'Add Task'}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setShowAddForm(true)}>
          + Add Task
        </Button>
      )}
    </AppShell>
  )
}
