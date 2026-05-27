import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getPaymentsForCouple, getUpcomingPayments } from '../lib/payments'
import { getTasksForCouple } from '../lib/tasks'
import { type Couple, type Payment, type Task } from '../types/database'

export default function RightPanel() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const [p, t] = await Promise.all([
        getPaymentsForCouple(c.id),
        getTasksForCouple(c.id),
      ])
      setPayments(p)
      setTasks(t)
    }
    load()
  }, [])

  const daysUntil = couple?.wedding_date
    ? Math.ceil((new Date(couple.wedding_date).getTime() - Date.now()) / 86400000)
    : null

  const upcoming = getUpcomingPayments(payments).slice(0, 4)
  const today = new Date().toISOString().split('T')[0]
  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 5)
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today)

  return (
    <div style={{
      width: '252px',
      flexShrink: 0,
      background: '#fff',
      borderLeft: '1px solid var(--color-border)',
      padding: '28px 18px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
    }}>

      {/* Couple profile + countdown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-accent) 0%, #9B5FA5 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '15px', fontWeight: 700,
          marginBottom: '10px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </div>

        {daysUntil !== null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, color: 'var(--color-accent)', lineHeight: 1 }}>
                {daysUntil}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>days to go</span>
            </div>
            {couple?.wedding_date && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                {new Date(couple.wedding_date + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Set your wedding date in Settings
          </p>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '22px' }} />

      {/* Upcoming payments */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '10px',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--color-text-secondary)', fontWeight: 600,
          margin: '0 0 14px 0',
        }}>
          Upcoming Payments
        </p>

        {upcoming.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            None scheduled
          </p>
        ) : upcoming.map(p => (
          <div key={p.id} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: '13px',
                color: 'var(--color-text-primary)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '130px',
              }}>
                {p.label}
              </span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: 'var(--color-text-primary)', flexShrink: 0 }}>
                ${p.amount.toLocaleString()}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {p.due_date ? `Due ${p.due_date}` : 'No due date'}
            </p>
          </div>
        ))}

        <button
          onClick={() => navigate('/finances')}
          style={{
            fontFamily: 'var(--font-body)', fontSize: '11px',
            color: 'var(--color-accent)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          View all payments →
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '22px' }} />

      {/* Pending tasks */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '10px',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0,
          }}>
            Tasks
          </p>
          {overdueTasks.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: '10px',
              background: '#FEE2E2', color: '#B91C1C',
              padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
            }}>
              {overdueTasks.length} overdue
            </span>
          )}
        </div>

        {pendingTasks.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            All caught up!
          </p>
        ) : pendingTasks.map(t => {
          const isOverdue = t.due_date && t.due_date < today
          return (
            <div key={t.id} style={{ display: 'flex', gap: '9px', marginBottom: '11px', alignItems: 'flex-start' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                border: '2px solid var(--color-border)',
                flexShrink: 0, marginTop: '5px',
              }} />
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '12px',
                  color: 'var(--color-text-primary)', margin: '0 0 1px 0', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t.title}
                </p>
                {t.due_date && (
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: '10px',
                    color: isOverdue ? '#B91C1C' : 'var(--color-text-secondary)',
                    margin: 0, fontWeight: isOverdue ? 600 : 400,
                  }}>
                    {isOverdue ? '⚠ ' : ''}Due {t.due_date}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={() => navigate('/todos')}
          style={{
            fontFamily: 'var(--font-body)', fontSize: '11px',
            color: 'var(--color-accent)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px',
          }}
        >
          View all tasks →
        </button>
      </div>
    </div>
  )
}
