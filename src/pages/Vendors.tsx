import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { MultiSegmentRing } from '../components/MultiSegmentRing'
import { supabase } from '../lib/supabase'
import { getCoupleForUser, updateCouple } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import {
  getCategoriesForCouple,
  addCategory,
  updateCategoryLabel,
  deleteCategory,
  reorderCategories,
  type VendorCategoryConfig,
} from '../lib/categories'
import { type Vendor, IN_PROGRESS_STATUSES } from '../types/database'

// (imported from types/database — was a local duplicate)

// Typical months before wedding when each vendor category should be booked
const VENDOR_URGENCY: Record<string, number> = {
  venue: 14,
  photographer: 12,
  videographer: 12,
  caterer: 12,
  band: 12,
  officiant: 9,
  florist: 9,
  dj: 9,
  hair_makeup: 9,
  invitations: 8,
  cake: 6,
  transportation: 6,
  hotels: 6,
  honeymoon: 6,
  rehearsal_dinner: 4,
  favors: 3,
}

function getUrgencyMonths(slug: string): number {
  return VENDOR_URGENCY[slug] ?? 6
}

function urgencyLabel(months: number): string {
  if (months >= 12) return 'Book 12+ months out'
  if (months >= 9) return 'Book 9–12 months out'
  if (months >= 6) return 'Book 6–9 months out'
  if (months >= 4) return 'Book 4–6 months out'
  return 'Book 3–4 months out'
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<VendorCategoryConfig[]>([])
  const [couple, setCouple] = useState<Awaited<ReturnType<typeof getCoupleForUser>>>(null)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [vendorSort, setVendorSort] = useState<'recommended' | 'custom'>('recommended')
  const [reordering, setReordering] = useState(false)
  const [editLabel, setEditLabel] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const navigate = useNavigate()

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const coupleData = await getCoupleForUser(user.id)
      if (!coupleData) return
      setCoupleId(coupleData.id)
      setCouple(coupleData)
      const cats = await getCategoriesForCouple(coupleData.id)
      await seedDefaultVendorCategories(coupleData.id, cats.map(c => c.slug))
      setVendors(await getVendorsForCouple(coupleData.id))
      setVendorSort(coupleData.vendor_sort === 'custom' ? 'custom' : 'recommended')
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Months until wedding (null if no wedding date set)
  const monthsUntilWedding: number | null = (() => {
    if (!couple?.wedding_date) return null
    const wedding = new Date(couple.wedding_date)
    const today = new Date()
    const diffMs = wedding.getTime() - today.getTime()
    return diffMs / (1000 * 60 * 60 * 24 * 30.44)
  })()

  const vendorsByCategory = categories.map(cat => {
    const catVendors = vendors.filter(v => v.category === cat.slug && v.status !== 'eliminated')
    const booked = catVendors.find(v => v.status === 'booked')
    const active = catVendors.filter(v => IN_PROGRESS_STATUSES.includes(v.status))
    const shortlistedCount = catVendors.filter(v => v.status === 'shortlisted').length

    let state: 'booked' | 'in_progress' | 'not_started'
    if (booked) state = 'booked'
    else if (active.length > 0) state = 'in_progress'
    else state = 'not_started'

    let subLabel = ''
    if (state === 'booked' && booked?.name) subLabel = booked.name
    else if (state === 'in_progress') {
      if (active.some(v => v.status === 'in_contract')) subLabel = 'In contract'
      else if (shortlistedCount > 0) subLabel = `${shortlistedCount} shortlisted`
      else if (active.some(v => v.status === 'meeting_scheduled')) subLabel = 'Meeting scheduled'
      else subLabel = 'Researching'
    }

    let nextAction = ''
    if (state === 'not_started') nextAction = 'Get quotes'
    else if (state === 'in_progress' && shortlistedCount > 0) nextAction = `Compare ${shortlistedCount} proposal${shortlistedCount > 1 ? 's' : ''}`

    const urgencyMonths = getUrgencyMonths(cat.slug)
    // Overdue: not yet booked and past the typical booking window
    const isOverdue = state !== 'booked' && monthsUntilWedding !== null && monthsUntilWedding < urgencyMonths

    return {
      category: cat.slug,
      label: cat.label,
      catId: cat.id,
      state,
      subLabel,
      nextAction,
      activeCount: active.length,
      urgencyMonths,
      isOverdue,
      urgencyText: urgencyLabel(urgencyMonths),
    }
  })

  // 'custom' follows the couple's own arrangement (vendor_categories.sort_order,
  // which `categories` is already fetched in). 'recommended' surfaces booked
  // first, then anything overdue, then whatever needs booking soonest.
  const categoryOrder = new Map(categories.map((c, i) => [c.slug, i]))
  const sortedVendors = vendorSort === 'custom'
    ? [...vendorsByCategory].sort(
        (a, b) => (categoryOrder.get(a.category) ?? 999) - (categoryOrder.get(b.category) ?? 999)
      )
    : [...vendorsByCategory].sort((a, b) => {
        if (a.state === 'booked' && b.state !== 'booked') return -1
        if (a.state !== 'booked' && b.state === 'booked') return 1
        if (a.isOverdue && !b.isOverdue) return -1
        if (!a.isOverdue && b.isOverdue) return 1
        return b.urgencyMonths - a.urgencyMonths
      })

  const bookedCount = vendorsByCategory.filter(v => v.state === 'booked').length
  const activeCount = vendorsByCategory.filter(v => v.state === 'in_progress').length
  const notStartedCount = vendorsByCategory.filter(v => v.state === 'not_started').length
  const overdueCount = vendorsByCategory.filter(v => v.isOverdue).length
  const total = categories.length

  // Expected booked count based on months until wedding
  const expectedBooked: number | null = (() => {
    if (monthsUntilWedding === null) return null
    if (monthsUntilWedding >= 12) return 2
    if (monthsUntilWedding >= 9) return 5
    if (monthsUntilWedding >= 6) return 8
    if (monthsUntilWedding >= 3) return 11
    return total
  })()

  const arcData = [
    ...(bookedCount > 0 ? [{ value: bookedCount, color: '#7B8F6B' }] : []),
    ...(activeCount > 0 ? [{ value: activeCount, color: '#B8926A' }] : []),
    ...(notStartedCount > 0 ? [{ value: notStartedCount, color: '#D4CFC8' }] : []),
  ]

  async function handleSaveLabel(id: string) {
    if (!editLabel.trim()) return
    try {
      await updateCategoryLabel(id, editLabel.trim())
      setEditingId(null)
      setEditLabel('')
      const cats = await getCategoriesForCouple(coupleId!)
      setCategories(cats)
    } catch {
      // ignore — stays in edit mode
    }
  }

  async function handleDelete(id: string, slug: string) {
    if (!coupleId) return
    const result = await deleteCategory(id, slug, coupleId)
    if (!result.ok) {
      alert(result.reason ?? 'Cannot delete this category.')
      return
    }
    const cats = await getCategoriesForCouple(coupleId)
    setCategories(cats)
    setVendors(await getVendorsForCouple(coupleId))
  }

  async function persistSort(next: 'recommended' | 'custom') {
    setVendorSort(next)
    if (!coupleId) return
    // Best-effort: the ordering already applied locally, so a failed write
    // shouldn't throw away the interaction.
    updateCouple(coupleId, { vendor_sort: next }).catch(() => {})
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction
    if (!coupleId || target < 0 || target >= categories.length || reordering) return
    const next = [...categories]
    ;[next[index], next[target]] = [next[target], next[index]]
    setCategories(next)          // optimistic; the list is the source of order
    setReordering(true)
    try {
      await reorderCategories(next.map(c => c.id))
      // Reordering is only meaningful if the page actually respects it.
      if (vendorSort !== 'custom') await persistSort('custom')
    } catch {
      setCategories(categories)  // put it back rather than lying about the order
      alert('Could not save the new order. Please try again.')
    } finally {
      setReordering(false)
    }
  }

  async function handleAddCategory() {
    if (!newLabel.trim() || !coupleId) return
    setAddError(null)
    setSavingNew(true)
    try {
      await addCategory(coupleId, newLabel.trim())
      setNewLabel('')
      const cats = await getCategoriesForCouple(coupleId)
      setCategories(cats)
      setVendors(await getVendorsForCouple(coupleId))
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add category.')
    } finally {
      setSavingNew(false)
    }
  }

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Vendors</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Track and manage all your wedding vendors</div>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginRight: '8px' }}>
          {(['recommended', 'custom'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => persistSort(mode)}
              title={mode === 'recommended'
                ? 'Booked first, then anything overdue, then what needs booking soonest'
                : 'The order you set in Manage Categories'}
              style={{
                fontFamily: 'var(--font-body)', fontSize: '12px', padding: '6px 12px',
                border: '1px solid var(--color-border)', borderRadius: '8px',
                background: vendorSort === mode ? 'rgba(184,146,106,0.10)' : 'transparent',
                color: vendorSort === mode ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontWeight: vendorSort === mode ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {mode === 'recommended' ? 'Recommended' : 'My order'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setManaging(m => !m)}
          style={{
            fontFamily: 'var(--font-body)', fontSize: '12px', padding: '6px 14px',
            border: '1px solid var(--color-border)', borderRadius: '8px',
            background: managing ? 'var(--color-accent)' : 'transparent',
            color: managing ? '#fff' : 'var(--color-text-secondary)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}
        >
          {managing ? 'Done' : 'Manage Categories'}
        </button>
      </div>

      {/* Category management panel */}
      {managing && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', marginBottom: '14px', background: '#fdfaf7' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', fontWeight: 600 }}>
            Vendor Categories
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', margin: '-6px 0 12px 0' }}>
            Reorder these to control how your vendor dashboard is arranged. Doing so switches it to <strong>My order</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {categories.map((cat, i) => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingId !== cat.id && (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                    <button
                      onClick={() => moveCategory(i, -1)}
                      disabled={i === 0 || reordering}
                      title="Move up"
                      aria-label={`Move ${cat.label} up`}
                      style={{ lineHeight: 1, fontSize: '9px', padding: '1px 4px', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#fff', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.35 : 1, color: 'var(--color-text-secondary)' }}
                    >▲</button>
                    <button
                      onClick={() => moveCategory(i, 1)}
                      disabled={i === categories.length - 1 || reordering}
                      title="Move down"
                      aria-label={`Move ${cat.label} down`}
                      style={{ lineHeight: 1, fontSize: '9px', padding: '1px 4px', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#fff', cursor: i === categories.length - 1 ? 'default' : 'pointer', opacity: i === categories.length - 1 ? 0.35 : 1, color: 'var(--color-text-secondary)' }}
                    >▼</button>
                  </span>
                )}
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveLabel(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus
                      style={{ flex: 1, padding: '5px 10px', fontSize: '13px', borderRadius: '7px', border: '1.5px solid var(--color-accent)', fontFamily: 'var(--font-body)' }}
                    />
                    <button onClick={() => handleSaveLabel(cat.id)} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)' }}>{cat.label}</span>
                    <button
                      onClick={() => { setEditingId(cat.id); setEditLabel(cat.label) }}
                      style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.slug)}
                      style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#C4785C', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <input
              placeholder="New category name"
              value={newLabel}
              onChange={e => { setNewLabel(e.target.value); setAddError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
              style={{ flex: 1, padding: '6px 10px', fontSize: '13px', borderRadius: '7px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)' }}
            />
            <button
              onClick={handleAddCategory}
              disabled={savingNew || !newLabel.trim()}
              style={{
                fontFamily: 'var(--font-body)', fontSize: '12px', padding: '6px 14px',
                border: 'none', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff',
                cursor: savingNew || !newLabel.trim() ? 'default' : 'pointer',
                opacity: !newLabel.trim() ? 0.5 : 1,
              }}
            >
              {savingNew ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addError && <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#C4785C', margin: '6px 0 0 0' }}>{addError}</p>}
        </div>
      )}

      {/* Summary bar with segmented arc chart */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', background: '#fff', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <MultiSegmentRing data={arcData} totalValue={total} size={80} strokeWidth={14} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {bookedCount}<span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>/{total}</span>
              </div>
              <div style={{ fontSize: '9px', color: '#7B8F6B', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Booked</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>{activeCount}</div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Active</div>
            </div>
            {overdueCount > 0 ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#C4785C', lineHeight: 1 }}>{overdueCount}</div>
                <div style={{ fontSize: '9px', color: '#C4785C', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Overdue</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-muted)', lineHeight: 1 }}>{notStartedCount}</div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>To do</div>
              </div>
            )}
          </div>
          {expectedBooked !== null && bookedCount < expectedBooked && (
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '6px', fontFamily: 'var(--font-body)' }}>
              Most couples at this stage have ~{expectedBooked} vendors booked.
            </div>
          )}
        </div>
      </div>

      {/* 3-column vendor grid sorted by urgency */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[7px]">
        {sortedVendors.map(({ category, label, state, subLabel, nextAction, activeCount: cnt, isOverdue, urgencyText }) => {
          const isHovered = hoveredCategory === category
          const borderColor = isOverdue
            ? '#C4785C'
            : state === 'booked' ? '#7B8F6B'
            : state === 'in_progress' ? '#B8926A'
            : '#D4CFC8'
          const tileStyle = isOverdue
            ? { border: '1px solid #E8C4B4', background: '#FDF3EF', borderLeft: `4px solid ${borderColor}` }
            : state === 'booked'
            ? { border: '1.5px solid #C8D8C0', background: '#EFF4EC', borderLeft: `4px solid ${borderColor}` }
            : state === 'in_progress'
            ? { border: '1px solid #E8D4BA', background: '#FBF6F0', borderLeft: `4px solid ${borderColor}` }
            : { border: '1px solid var(--color-border)', background: '#F5F1EC', borderLeft: `4px solid ${borderColor}` }

          return (
            <div
              key={category}
              style={{
                ...tileStyle,
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
                boxShadow: isHovered ? '0 4px 12px rgba(140,120,100,0.12)' : 'none',
              }}
              onMouseEnter={() => setHoveredCategory(category)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => navigate(`/vendors/${category}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                  fontWeight: state === 'booked' ? 700 : 600,
                  color: isOverdue ? '#C4785C' : state === 'booked' ? '#5A7A4A' : 'var(--color-text-primary)',
                  fontSize: '12px',
                }}>
                  {label}
                </div>
                {state === 'booked' && (
                  <span style={{ fontSize: '9px', background: '#E8F0E4', color: '#5A7A4A', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>
                    BOOKED
                  </span>
                )}
                {isOverdue && (
                  <span style={{ fontSize: '9px', background: '#F9E4DC', color: '#C4785C', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>
                    OVERDUE
                  </span>
                )}
                {!isOverdue && state === 'in_progress' && cnt > 0 && (
                  <span style={{ fontSize: '9px', background: 'var(--color-sidebar-active)', color: 'var(--color-accent)', padding: '1px 5px', borderRadius: '6px', fontWeight: 600, flexShrink: 0 }}>
                    {cnt}
                  </span>
                )}
              </div>
              {subLabel && (
                <div style={{ fontSize: '11px', color: state === 'booked' ? '#5A7A4A' : state === 'in_progress' ? 'var(--color-accent)' : 'var(--color-text-muted)', fontWeight: 500 }}>
                  {subLabel}
                </div>
              )}
              {nextAction && (
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                  → {nextAction}
                </div>
              )}
              {state !== 'booked' && (
                <div style={{ fontSize: '10px', color: isOverdue ? '#C4785C' : 'var(--color-text-muted)', fontWeight: isOverdue ? 600 : 400, marginTop: '2px' }}>
                  {urgencyText}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
