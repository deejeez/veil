import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser, updateCouple } from '../lib/couple'
import type { Couple } from '../types/database'

export default function Settings() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const [form, setForm] = useState({
    name_primary: '',
    name_partner: '',
    wedding_date: '',
    venue_name: '',
    city: '',
    state: '',
    budget_total: '',
    family_a_name: '',
    family_b_name: '',
  })

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      setForm({
        name_primary: c.name_primary ?? '',
        name_partner: c.name_partner ?? '',
        wedding_date: c.wedding_date ?? '',
        venue_name: c.venue_name ?? '',
        city: c.city ?? '',
        state: c.state ?? '',
        budget_total: c.budget_total != null ? c.budget_total.toLocaleString() : '',
        family_a_name: c.family_a_name ?? '',
        family_b_name: c.family_b_name ?? '',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!couple) return
    setSaving(true)
    setSaved(false)
    try {
      await updateCouple(couple.id, {
        name_primary: form.name_primary || null,
        name_partner: form.name_partner || null,
        wedding_date: form.wedding_date || null,
        venue_name: form.venue_name || null,
        city: form.city || null,
        state: form.state || null,
        budget_total: form.budget_total ? Number(form.budget_total.replace(/,/g, '')) : null,
        family_a_name: form.family_a_name || null,
        family_b_name: form.family_b_name || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInvitePartner() {
    if (!couple || !partnerEmail) return
    setInviting(true)
    try {
      const { error } = await supabase.functions.invoke('invite-partner', {
        body: { couple_id: couple.id, partner_email: partnerEmail },
      })
      if (error) throw error
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const updated = await getCoupleForUser(user.id)
        if (updated) setCouple(updated)
      }
      setInviteSuccess(true)
      setPartnerEmail('')
    } catch (err) {
      console.error('Invite failed:', err)
      alert('Failed to send invite. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const chipLabel = (key: 'couple' | 'family_a' | 'family_b') => {
    if (key === 'couple') return 'Couple'
    if (key === 'family_a') return form.family_a_name || 'Family A'
    return form.family_b_name || 'Family B'
  }

  if (loading) {
    return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Settings</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Manage your wedding details and preferences</div>
        </div>

        {/* Couple names */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Your Names
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            First names shown on your dashboard — "Marco & Sarah"
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Your first name</label>
              <input
                value={form.name_primary}
                onChange={e => setForm(f => ({ ...f, name_primary: e.target.value }))}
                placeholder="Marco"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Partner's first name</label>
              <input
                value={form.name_partner}
                onChange={e => setForm(f => ({ ...f, name_partner: e.target.value }))}
                placeholder="Sarah"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Partner invite */}
        {couple && !couple.email_partner && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Invite Partner
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              Give your partner access to view and edit this planner together.
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="email"
                placeholder="partner@email.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvitePartner() }}
                style={{ flex: 1, display: 'block' }}
              />
              <Button onClick={handleInvitePartner} disabled={inviting || !partnerEmail.trim()}>
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
            {inviteSuccess && (
              <div style={{ fontSize: '13px', color: 'var(--color-status-booked)', fontWeight: 600, marginTop: '8px' }}>
                ✓ Invite sent!
              </div>
            )}
          </div>
        )}
        {couple?.email_partner && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Partner Access
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {couple.email_partner}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Partner has been invited to this planner.</div>
          </div>
        )}

        {/* Wedding details */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            Wedding Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Venue Name</label>
              <input
                value={form.venue_name}
                onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                placeholder="The Grand Ballroom"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Wedding Date</label>
              <input
                type="date"
                value={form.wedding_date}
                onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value }))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Total Budget ($)</label>
              <input
                type="text"
                value={form.budget_total}
                onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))}
                placeholder="e.g. 200,000"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={labelStyle}>City</label>
              <input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="New York"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={labelStyle}>State</label>
              <input
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                placeholder="NY"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Family names */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Family Names
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            Name each side of the family. These labels appear when recording payments.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Family A</label>
              <input
                value={form.family_a_name}
                onChange={e => setForm(f => ({ ...f, family_a_name: e.target.value }))}
                placeholder="e.g. Thompson Family"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Family B</label>
              <input
                value={form.family_b_name}
                onChange={e => setForm(f => ({ ...f, family_b_name: e.target.value }))}
                placeholder="e.g. Rivera Family"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: '#F5F1EC', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Preview — Payment attribution
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['couple', 'family_a', 'family_b'] as const).map((key, i) => (
                <div
                  key={key}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: i === 0 ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                    color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    background: i === 0 ? 'var(--color-sidebar-active)' : '#fff',
                  }}
                >
                  {chipLabel(key)}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              When adding a payment, you'll toggle between these three options.
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          {saved && (
            <div style={{ fontSize: '13px', color: 'var(--color-status-booked)', fontWeight: 600 }}>
              ✓ Saved
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '4px',
}
