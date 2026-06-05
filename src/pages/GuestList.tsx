import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import SectionLabel from '../components/SectionLabel'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getGuestsForCouple, addGuest, deleteGuest } from '../lib/guests'
import type { Couple, Guest } from '../types/database'

type FilterKey = 'all' | 'a_list' | 'b_list' | 'bride' | 'groom'

type CsvRow = {
  name: string
  household: string
  side: string
  tier: string
  plus_ones: number
  kids: number
  error?: string
}

function parseGuestCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { rows: [], errors: ['CSV file is empty or has no data rows.'] }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const required = ['name', 'side']
  const missing = required.filter(r => !header.includes(r))
  if (missing.length > 0) return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}`] }

  const rows: CsvRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const get = (col: string) => vals[header.indexOf(col)] ?? ''

    const name = get('name')
    const side = get('side').toLowerCase()
    const tier = get('tier').toLowerCase() || 'a_list'
    const household = get('household') || null
    const plus_ones = parseInt(get('plus_ones') || '0', 10) || 0
    const kids = parseInt(get('kids') || '0', 10) || 0

    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue }
    if (!['bride', 'groom', 'mutual'].includes(side)) { errors.push(`Row ${i + 1}: side must be bride, groom, or mutual`); continue }
    if (!['a_list', 'b_list'].includes(tier)) { errors.push(`Row ${i + 1}: tier must be a_list or b_list`); continue }

    rows.push({ name, household: household ?? '', side, tier, plus_ones, kids })
  }

  return { rows, errors }
}

export default function GuestList() {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', household: '', side: 'mutual' as 'bride' | 'groom' | 'mutual', tier: 'a_list' as 'a_list' | 'b_list', plus_ones: 0, kids: 0 })
  const [saving, setSaving] = useState(false)

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvRow[]; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      setGuests(await getGuestsForCouple(c.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────

  function headcount(g: Guest) { return 1 + g.plus_ones + g.kids }

  const totalHeadcount = guests.reduce((sum, g) => sum + headcount(g), 0)
  const aListCount = guests.filter(g => g.tier === 'a_list').reduce((sum, g) => sum + headcount(g), 0)
  const bListCount = guests.filter(g => g.tier === 'b_list').reduce((sum, g) => sum + headcount(g), 0)
  const brideCount = guests.filter(g => g.side === 'bride').reduce((sum, g) => sum + headcount(g), 0)
  const groomCount = guests.filter(g => g.side === 'groom').reduce((sum, g) => sum + headcount(g), 0)
  const mutualCount = guests.filter(g => g.side === 'mutual').reduce((sum, g) => sum + headcount(g), 0)
  const perGuestCost = couple?.budget_total && totalHeadcount > 0
    ? Math.round(couple.budget_total / totalHeadcount)
    : null

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = guests.filter(g => {
    if (filter === 'a_list') return g.tier === 'a_list'
    if (filter === 'b_list') return g.tier === 'b_list'
    if (filter === 'bride') return g.side === 'bride'
    if (filter === 'groom') return g.side === 'groom'
    return true
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddGuest() {
    if (!couple || !addForm.name.trim()) return
    setSaving(true)
    try {
      const g = await addGuest({
        couple_id: couple.id,
        name: addForm.name.trim(),
        household: addForm.household.trim() || null,
        side: addForm.side,
        tier: addForm.tier,
        plus_ones: addForm.plus_ones,
        kids: addForm.kids,
      })
      setGuests(prev => [...prev, g])
      setAddForm({ name: '', household: '', side: 'mutual', tier: 'a_list', plus_ones: 0, kids: 0 })
      setShowAddForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err)
      alert('Failed to add guest: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGuest(id)
      setGuests(prev => prev.filter(g => g.id !== id))
    } catch {
      alert('Failed to remove guest. Please try again.')
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvPreview(parseGuestCsv(text))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleCsvImport() {
    if (!couple || !csvPreview || csvPreview.rows.length === 0) return
    setImporting(true)
    try {
      const added: Guest[] = []
      for (const row of csvPreview.rows) {
        const g = await addGuest({
          couple_id: couple.id,
          name: row.name,
          household: row.household || null,
          side: row.side as 'bride' | 'groom' | 'mutual',
          tier: row.tier as 'a_list' | 'b_list',
          plus_ones: row.plus_ones,
          kids: row.kids,
        })
        added.push(g)
      }
      setGuests(prev => [...prev, ...added])
      setCsvPreview(null)
    } catch {
      alert('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  const pillStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    padding: '5px 14px',
    borderRadius: '20px',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-sidebar-active)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.1s',
  })

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, margin: 0, color: '#2c2825' }}>
          Guest List
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCsvFile}
          />
          <Button
            variant="secondary"
            onClick={() => csvInputRef.current?.click()}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Import CSV
          </Button>
          <Button
            onClick={() => setShowAddForm(v => !v)}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            + Add Guest
          </Button>
        </div>
      </div>

      {/* CSV import guide — always visible when no guests yet, collapsible otherwise */}
      {guests.length === 0 && (
        <div style={{ padding: '16px 20px', background: '#FBF6F0', border: '1px solid var(--color-border)', borderLeft: '4px solid #B8926A', borderRadius: '10px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: '#2c2825', margin: '0 0 4px 0' }}>
                Import your guest list from a spreadsheet
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                Download the template below, fill it out in Excel or Google Sheets, then upload it here.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const csv = 'name,household,side,tier,plus_ones,kids\nJane Smith,Smith Family,bride,a_list,1,0\nBob Jones,,groom,a_list,0,2\nAlex Lee,Lee Family,mutual,b_list,1,1'
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'guest-list-template.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '7px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  ↓ Download Template
                </button>
                <button
                  onClick={() => csvInputRef.current?.click()}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '12px', padding: '6px 14px', borderRadius: '7px', border: '1.5px solid var(--color-accent)', color: 'var(--color-accent)', background: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Upload Filled CSV
                </button>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>Columns</p>
              <table style={{ fontFamily: 'monospace', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    { col: 'name', note: 'required', ex: 'Jane Smith' },
                    { col: 'side', note: 'required', ex: 'bride / groom / mutual' },
                    { col: 'household', note: 'optional', ex: 'Smith Family' },
                    { col: 'tier', note: 'optional', ex: 'a_list / b_list' },
                    { col: 'plus_ones', note: 'optional', ex: '0, 1, 2…' },
                    { col: 'kids', note: 'optional', ex: '0, 1, 2…' },
                  ].map(({ col, note, ex }) => (
                    <tr key={col}>
                      <td style={{ paddingRight: '10px', paddingBottom: '3px', color: '#2c2825', fontWeight: 600 }}>{col}</td>
                      <td style={{ paddingRight: '10px', paddingBottom: '3px', color: note === 'required' ? '#B8926A' : 'var(--color-text-muted)', fontSize: '10px' }}>{note}</td>
                      <td style={{ paddingBottom: '3px', color: 'var(--color-text-muted)' }}>{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Headcount dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]" style={{ marginBottom: '24px' }}>
        <Card style={{ padding: '18px 20px' }}>
          <SectionLabel>Total Guests</SectionLabel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '28px', fontWeight: 700, margin: 0 }}>{totalHeadcount}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{guests.length} entries</p>
        </Card>
        <Card style={{ padding: '18px 20px' }}>
          <SectionLabel>A-List / B-List</SectionLabel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
            {aListCount} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/</span> {bListCount}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>headcount</p>
        </Card>
        <Card style={{ padding: '18px 20px' }}>
          <SectionLabel>By Side</SectionLabel>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {brideCount} · {groomCount} · {mutualCount}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>bride · groom · mutual</p>
        </Card>
        <Card style={{ padding: '18px 20px' }}>
          <SectionLabel>Per-Guest Cost</SectionLabel>
          {perGuestCost !== null ? (
            <>
              <p className="currency currency-lg" style={{ margin: 0 }}>${perGuestCost.toLocaleString()}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>budget ÷ headcount</p>
            </>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>—</p>
          )}
        </Card>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: 'All' },
          { key: 'a_list', label: 'A-List' },
          { key: 'b_list', label: 'B-List' },
          { key: 'bride', label: 'Bride Side' },
          { key: 'groom', label: 'Groom Side' },
        ] as { key: FilterKey; label: string }[]).map(({ key, label }) => (
          <button key={key} style={pillStyle(filter === key)} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} · {filtered.reduce((s, g) => s + headcount(g), 0)} headcount
        </span>
      </div>

      {/* Guest table */}
      <Card style={{ padding: '0', overflow: 'hidden', marginBottom: '16px' }}>
        <div className="table-scroll-container" style={{ minWidth: 0 }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 40px 40px 70px 36px', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', minWidth: '520px' }}>
          {['Name', 'Household', 'Side', 'Tier', '+1s', 'Kids', 'Count', ''].map(h => (
            <p key={h} style={{ fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            {guests.length === 0 ? 'No guests yet — add one or import a CSV.' : 'No guests match this filter.'}
          </div>
        ) : (
          <div>
            {filtered.map((g, idx) => (
              <div
                key={g.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 80px 80px 40px 40px 70px 36px',
                  gap: '8px',
                  padding: '10px 16px',
                  alignItems: 'center',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)',
                  minWidth: '520px',
                }}
              >
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: '#2c2825', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.household ?? '—'}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, textTransform: 'capitalize' }}>{g.side}</p>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: g.tier === 'a_list' ? 'rgba(184,146,106,0.12)' : '#F5F1EC',
                  color: g.tier === 'a_list' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  display: 'inline-block',
                }}>
                  {g.tier === 'a_list' ? 'A-List' : 'B-List'}
                </span>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>{g.plus_ones}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>{g.kids}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: '#2c2825', margin: 0, textAlign: 'center' }}>{headcount(g)}</p>
                <button
                  onClick={() => handleDelete(g.id)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
                  title="Remove guest"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        </div>{/* end table-scroll-container */}
      </Card>

      {/* Add guest form */}
      {showAddForm && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionLabel>Add Guest</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px]" style={{ marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Name *</label>
              <input
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Household</label>
              <input
                value={addForm.household}
                onChange={e => setAddForm(f => ({ ...f, household: e.target.value }))}
                placeholder="Smith Family"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Side</label>
              <select
                value={addForm.side}
                onChange={e => setAddForm(f => ({ ...f, side: e.target.value as 'bride' | 'groom' | 'mutual' }))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              >
                <option value="bride">Bride</option>
                <option value="groom">Groom</option>
                <option value="mutual">Mutual</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Tier</label>
              <select
                value={addForm.tier}
                onChange={e => setAddForm(f => ({ ...f, tier: e.target.value as 'a_list' | 'b_list' }))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              >
                <option value="a_list">A-List</option>
                <option value="b_list">B-List</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>+1s</label>
              <input
                type="number"
                min={0}
                value={addForm.plus_ones}
                onChange={e => setAddForm(f => ({ ...f, plus_ones: Math.max(0, Number(e.target.value)) }))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Kids</label>
              <input
                type="number"
                min={0}
                value={addForm.kids}
                onChange={e => setAddForm(f => ({ ...f, kids: Math.max(0, Number(e.target.value)) }))}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: '13px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setShowAddForm(false)} style={{ fontSize: '13px', padding: '8px 18px' }}>Cancel</Button>
            <Button
              onClick={handleAddGuest}
              disabled={saving || !addForm.name.trim()}
              style={{ fontSize: '13px', padding: '8px 18px', opacity: saving || !addForm.name.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Adding...' : 'Add Guest'}
            </Button>
          </div>
        </Card>
      )}

      {/* CSV preview modal */}
      {csvPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '560px', maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 6px 0' }}>Import Guests</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
              {csvPreview.rows.length} guest{csvPreview.rows.length !== 1 ? 's' : ''} ready to import
              {csvPreview.errors.length > 0 && ` · ${csvPreview.errors.length} row${csvPreview.errors.length !== 1 ? 's' : ''} skipped`}
            </p>

            {/* Format guide */}
            <div style={{ padding: '10px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '14px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>Expected CSV format</p>
              <code style={{ fontFamily: 'monospace', fontSize: '11px', color: '#2c2825', display: 'block', marginBottom: '6px' }}>
                name,household,side,tier,plus_ones,kids
              </code>
              <code style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                Jane Smith,Smith Family,bride,a_list,1,0
              </code>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
                Required: <strong>name</strong>, <strong>side</strong> (bride / groom / mutual).
                Optional: household, tier (a_list / b_list, defaults to a_list), plus_ones, kids.
              </p>
            </div>

            {csvPreview.errors.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(196,120,92,0.07)', border: '1px solid rgba(196,120,92,0.25)', borderRadius: '8px', marginBottom: '16px' }}>
                {csvPreview.errors.map((err, i) => (
                  <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#C4785C', margin: i === 0 ? 0 : '4px 0 0 0' }}>{err}</p>
                ))}
              </div>
            )}

            {csvPreview.rows.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 60px 40px 40px', gap: '8px', padding: '8px 14px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Name', 'Household', 'Side', 'Tier', '+1s', 'Kids'].map(h => (
                    <p key={h} style={{ fontFamily: 'var(--font-body)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0 }}>{h}</p>
                  ))}
                </div>
                {csvPreview.rows.slice(0, 20).map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 60px 40px 40px', gap: '8px', padding: '8px 14px', borderBottom: i < csvPreview.rows.length - 1 ? '1px solid var(--color-border)' : 'none', alignItems: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: '#2c2825', margin: 0 }}>{row.name}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{row.household || '—'}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, textTransform: 'capitalize' }}>{row.side}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{row.tier === 'a_list' ? 'A-List' : 'B-List'}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>{row.plus_ones}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>{row.kids}</p>
                  </div>
                ))}
                {csvPreview.rows.length > 20 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>...and {csvPreview.rows.length - 20} more</p>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setCsvPreview(null)} style={{ fontSize: '13px', padding: '8px 18px' }}>Cancel</Button>
              <Button
                onClick={handleCsvImport}
                disabled={importing || csvPreview.rows.length === 0}
                style={{ fontSize: '13px', padding: '8px 18px', opacity: importing || csvPreview.rows.length === 0 ? 0.6 : 1 }}
              >
                {importing ? 'Importing...' : `Import ${csvPreview.rows.length} Guest${csvPreview.rows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
