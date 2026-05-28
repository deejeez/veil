import { useEffect, useState, type CSSProperties } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getTasksForCouple, insertTask, toggleTask, deleteTask } from '../lib/tasks'
import type { Couple, Task } from '../types/database'

const TASK_CATEGORIES = ['ceremony', 'venue', 'catering', 'vendors', 'guests', 'attire', 'decor', 'admin', 'honeymoon', 'other']

const TIMELINE_PHASES = [
  { id: '12plus', tasks: ['Set a total wedding budget', 'Choose your wedding date', 'Estimate guest count', 'Research and book your venue', 'Consider hiring a wedding planner'] },
  { id: '9to12', tasks: ['Send save-the-dates', 'Book photographer & videographer', 'Book caterer (or confirm venue catering)', 'Book florist', 'Book band or DJ', 'Start dress / attire shopping'] },
  { id: '6to9', tasks: ['Book officiant', 'Book hair & makeup artists', 'Book transportation', 'Start planning honeymoon', 'Finalize wedding party'] },
  { id: '3to6', tasks: ['Send formal invitations (8–10 weeks before)', 'Register for gifts', 'Schedule menu tasting with caterer', 'Order wedding cake', 'Plan rehearsal dinner', 'Arrange accommodations for out-of-town guests'] },
  { id: '1to3', tasks: ['Confirm all vendor bookings', 'Obtain marriage license', 'Final dress / suit fitting', 'Create seating chart', 'Write vows', 'Book honeymoon flights & hotel (if not done)'] },
  { id: 'weekof', tasks: ['Confirm day-of timeline with all vendors', 'Final headcount to caterer', 'Pack for honeymoon', 'Prepare emergency kit (safety pins, stain pen, mints)', 'Enjoy your rehearsal dinner'] },
]

function getUpcomingTimelineTasks(weddingDate: string | null | undefined): string[] {
  let phaseIdx = 0
  if (weddingDate) {
    const d = new Date(weddingDate + 'T12:00:00')
    const diffMonths = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)
    if (diffMonths >= 12) phaseIdx = 0
    else if (diffMonths >= 9) phaseIdx = 1
    else if (diffMonths >= 6) phaseIdx = 2
    else if (diffMonths >= 3) phaseIdx = 3
    else if (diffMonths >= 0) phaseIdx = 4
    else phaseIdx = 5
  }
  const tasks: string[] = []
  for (let i = phaseIdx; i < TIMELINE_PHASES.length && tasks.length < 3; i++) {
    for (const t of TIMELINE_PHASES[i].tasks) {
      tasks.push(t)
      if (tasks.length === 3) break
    }
  }
  return tasks
}

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

  const today = new Date().toISOString().split('T')[0]

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  const pendingCount = tasks.filter(t => !t.completed).length
  const overdueCount = tasks.filter(t => !t.completed && t.due_date && t.due_date < today).length

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
              Nothing due right now. Coming up on your timeline:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {getUpcomingTimelineTasks(couple?.wedding_date).map((task, i) => (
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

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  {task.assigned_to && task.assigned_to !== 'couple' && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-accent)' }}>
                      {task.assigned_to}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
              <input placeholder="couple" value={newTask.assigned_to} onChange={e => setNewTask(f => ({ ...f, assigned_to: e.target.value }))} style={inputStyle} />
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
