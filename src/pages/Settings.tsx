import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser, updateCouple } from '../lib/couple'
import type { Couple, Person } from '../types/database'
import { getPeopleForCouple, addPerson, renamePerson, deletePerson } from '../lib/people'

export default function Settings() {
  const [people, setPeople] = useState<Person[]>([])
  const [newPersonName, setNewPersonName] = useState('')
  const [personSaving, setPersonSaving] = useState(false)
  const [personError, setPersonError] = useState<string | null>(null)
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState('')

  const navigate = useNavigate()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const [form, setForm] = useState({
    name_primary: '',
    name_partner: '',
    wedding_date: '',
    venue_name: '',
    city: '',
    state: '',
    budget_total: '',
    guest_count: '',
    family_a_name: '',
    family_b_name: '',
  })

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? null)
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      getPeopleForCouple(c.id).then(setPeople).catch(() => {})
      setForm({
        name_primary: c.name_primary ?? '',
        name_partner: c.name_partner ?? '',
        wedding_date: c.wedding_date ?? '',
        venue_name: c.venue_name ?? '',
        city: c.city ?? '',
        state: c.state ?? '',
        budget_total: c.budget_total != null ? c.budget_total.toLocaleString() : '',
        guest_count: c.guest_count != null ? String(c.guest_count) : '',
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
        guest_count: form.guest_count ? Number(form.guest_count) : null,
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

  async function handleDeleteAccount() {
    if (!couple) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // Delete child tables first, then couple row
      const tables = ['ai_insights', 'payments', 'guests', 'vendors', 'budget_categories', 'contracts'] as const
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('couple_id', couple.id)
        if (error) console.warn(`Failed to delete from ${table}:`, error.message)
      }
      // Delete couple row
      const { error: coupleError } = await supabase.from('couples').delete().eq('id', couple.id)
      if (coupleError) throw coupleError
      // Delete auth user via edge function
      const { error: fnError } = await supabase.functions.invoke('delete-account')
      if (fnError) console.warn('Auth user deletion failed:', fnError)
      // Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = 'https://getwed.ai'
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setDeleting(false)
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

  async function handleAddPerson() {
    const name = newPersonName.trim()
    if (!couple || !name || personSaving) return
    setPersonSaving(true)
    setPersonError(null)
    try {
      const p = await addPerson(couple.id, name)
      setPeople(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
      setNewPersonName('')
    } catch (err: unknown) {
      // The (couple_id, name) unique constraint is the likely failure.
      const msg = (err as { message?: string })?.message ?? ''
      setPersonError(msg.includes('duplicate') || msg.includes('unique')
        ? `${name} is already on the list.`
        : 'Could not add that person. Please try again.')
    } finally {
      setPersonSaving(false)
    }
  }

  async function handleRenamePerson(id: string) {
    const name = editingPersonName.trim()
    if (!name) return
    try {
      await renamePerson(id, name)
      setPeople(prev => prev.map(p => p.id === id ? { ...p, name } : p).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingPersonId(null)
    } catch {
      setPersonError('Could not rename that person.')
    }
  }

  async function handleDeletePerson(id: string) {
    try {
      await deletePerson(id)
      setPeople(prev => prev.filter(p => p.id !== id))
    } catch {
      setPersonError('Could not remove that person.')
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Page header */}
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Settings</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Manage your wedding details and preferences</div>
        </div>

        {/* Account row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Account
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
              {userEmail ?? '...'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1.5px solid var(--color-border)',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F5F1EC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Log Out
          </button>
        </div>

        {/* Couple names */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Your Names
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            First names shown on your dashboard — "Marco & Sarah"
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Wedding Details
            </div>
            <button
              type="button"
              onClick={() => navigate('/onboarding/1')}
              style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 0, fontWeight: 500 }}
            >
              Re-run Setup →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
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

            <div>
              <label style={labelStyle}>Approximate Guest Count</label>
              <input
                type="number"
                value={form.guest_count}
                onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))}
                placeholder="e.g. 150"
                min="1"
                max="2000"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

          </div>
        </div>

        {/* People */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            People
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            Anyone helping plan — a planner, a parent, your wedding party. They become options when assigning tasks. You and {form.name_partner || 'your partner'} are always available.
          </div>

          {people.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {people.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  {editingPersonId === p.id ? (
                    <>
                      <input
                        value={editingPersonName}
                        onChange={e => setEditingPersonName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenamePerson(p.id); if (e.key === 'Escape') setEditingPersonId(null) }}
                        autoFocus
                        style={{ flex: 1, display: 'block', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => handleRenamePerson(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)' }}>Save</button>
                      <button type="button" onClick={() => setEditingPersonId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)' }}>{p.name}</span>
                      <button type="button" onClick={() => { setEditingPersonId(p.id); setEditingPersonName(p.name) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)' }}>Rename</button>
                      <button type="button" onClick={() => handleDeletePerson(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>Remove</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <input
              value={newPersonName}
              onChange={e => { setNewPersonName(e.target.value); setPersonError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleAddPerson() }}
              placeholder="e.g. Mom, Sarah (planner)"
              style={{ flex: 1, display: 'block', boxSizing: 'border-box' }}
            />
            <Button onClick={handleAddPerson} disabled={personSaving || !newPersonName.trim()}>
              {personSaving ? 'Adding...' : 'Add'}
            </Button>
          </div>

          {personError && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#C4785C', margin: '8px 0 0 0' }}>{personError}</p>
          )}

          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '10px 0 0 0', lineHeight: 1.5 }}>
            Removing someone leaves their existing tasks alone — those still show their name.
          </p>
        </div>

        {/* Family names */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', background: '#fff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Family Names
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            Name each side of the family. These labels appear when recording payments.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]" style={{ marginBottom: '16px' }}>
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

        {/* Legal */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
            Legal
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            The terms and policies that apply to your Veil account.
          </p>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
            <Link to="/privacy" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#C4785C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
            Danger Zone
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
            Permanently delete your account and all your wedding planning data. This cannot be undone.
          </p>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(null) }}
            style={{
              background: 'none',
              border: '1.5px solid #C4785C',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '13px',
              color: '#C4785C',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#C4785C'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#C4785C' }}
          >
            Delete My Account
          </button>
        </div>

      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          onClick={() => { if (!deleting) setShowDeleteModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(44,40,37,0.5)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '440px',
              background: '#fff', borderRadius: '14px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              padding: '32px',
            }}
          >
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400,
              color: 'var(--color-text-primary)', margin: '0 0 8px 0',
            }}>
              Are you sure?
            </h3>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '13px', lineHeight: 1.6,
              color: 'var(--color-text-secondary)', margin: '0 0 20px 0',
            }}>
              This will permanently delete your account, all your wedding data, vendor information, budget, payments, and guest list. This action cannot be undone.
            </p>

            {deleteError && (
              <div style={{ background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                <p style={{ color: '#C4785C', fontSize: '12px', margin: 0, fontFamily: 'var(--font-body)' }}>{deleteError}</p>
              </div>
            )}

            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', display: 'block', marginBottom: '6px' }}>
              Type <strong style={{ color: 'var(--color-text-primary)' }}>DELETE</strong> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              autoFocus
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: '20px' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: '9px 20px', borderRadius: '8px',
                  border: '1.5px solid var(--color-border)', background: 'none',
                  fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)',
                  cursor: deleting ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: deleteConfirmText === 'DELETE' && !deleting ? '#C4785C' : '#D4CFC8',
                  fontSize: '13px', fontWeight: 600, color: '#fff',
                  cursor: deleteConfirmText === 'DELETE' && !deleting ? 'pointer' : 'default',
                  fontFamily: 'var(--font-body)',
                  transition: 'background 0.15s ease',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
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
