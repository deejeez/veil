import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import {
  getCategoriesForCouple,
  addCategory,
  updateCategoryLabel,
  deleteCategory,
  type VendorCategoryConfig,
} from '../lib/categories'
import { type Vendor } from '../types/database'

const IN_PROGRESS_STATUSES = ['researching', 'shortlisted', 'meeting_scheduled']

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<VendorCategoryConfig[]>([])
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const navigate = useNavigate()

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const couple = await getCoupleForUser(user.id)
      if (!couple) return
      setCoupleId(couple.id)
      const cats = await getCategoriesForCouple(couple.id)
      await seedDefaultVendorCategories(couple.id, cats.map(c => c.slug))
      setVendors(await getVendorsForCouple(couple.id))
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
      if (shortlistedCount > 0) subLabel = `${shortlistedCount} shortlisted`
      else if (active.some(v => v.status === 'meeting_scheduled')) subLabel = 'Meeting scheduled'
      else subLabel = 'Researching'
    }

    return { category: cat.slug, label: cat.label, catId: cat.id, state, subLabel, activeCount: active.length }
  })

  const bookedCount = vendorsByCategory.filter(v => v.state === 'booked').length
  const activeCount = vendorsByCategory.filter(v => v.state === 'in_progress').length
  const notStartedCount = vendorsByCategory.filter(v => v.state === 'not_started').length
  const total = categories.length

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
          <div style={{ fontSize: '12px', color: '#aaa' }}>Track and manage all your wedding vendors</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
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
          {addError && <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#B91C1C', margin: '6px 0 0 0' }}>{addError}</p>}
        </div>
      )}

      {/* Summary bar */}
      <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', background: '#fff', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', minWidth: '36px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            {bookedCount}<span style={{ fontSize: '11px', color: '#ccc' }}>/{total}</span>
          </div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Booked</div>
        </div>
        <div style={{ flex: 1, height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: total > 0 ? `${(bookedCount / total) * 100}%` : '0%', height: '100%', background: '#4caf50', borderRadius: '3px' }} />
        </div>
        <div style={{ textAlign: 'center', minWidth: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#c4788a', lineHeight: 1 }}>{activeCount}</div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Active</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '28px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ccc', lineHeight: 1 }}>{notStartedCount}</div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>To do</div>
        </div>
      </div>

      {/* 3-column vendor grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
        {vendorsByCategory.map(({ category, label, state, subLabel, activeCount: cnt }) => {
          const tileStyle =
            state === 'booked'
              ? { border: '1.5px solid #a5d6a7', background: '#f0faf0' }
              : state === 'in_progress'
              ? { border: '1px solid #e8c4ce', background: '#fdf5f7' }
              : { border: '1px solid #e0e0e0', background: '#f5f5f5' }

          return (
            <div
              key={category}
              style={{ ...tileStyle, borderRadius: '8px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}
              onClick={() => navigate(`/vendors/${category}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: state === 'booked' ? 700 : 600, color: state === 'booked' ? '#1b5e20' : 'var(--color-text-primary)', fontSize: '12px' }}>
                  {label}
                </div>
                {state === 'booked' && (
                  <span style={{ fontSize: '9px', background: '#c8e6c9', color: '#2e7d32', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>
                    BOOKED
                  </span>
                )}
                {state === 'in_progress' && cnt > 0 && (
                  <span style={{ fontSize: '9px', background: '#fce4ec', color: '#c4788a', padding: '1px 5px', borderRadius: '6px', fontWeight: 600, flexShrink: 0 }}>
                    {cnt}
                  </span>
                )}
              </div>
              {subLabel && (
                <div style={{ fontSize: '11px', color: state === 'booked' ? '#388e3c' : state === 'in_progress' ? '#c4788a' : '#888', fontWeight: 500 }}>
                  {subLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
