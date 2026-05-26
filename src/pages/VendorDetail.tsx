import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, upsertVendor, updateVendorStatus, deleteVendor } from '../lib/vendors'
import { Couple, Vendor, VendorStatus, VENDOR_CATEGORY_LABELS } from '../types/database'

export default function VendorDetail() {
  const { category } = useParams<{ category: string }>()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Vendor>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const all = await getVendorsForCouple(c.id)
      setVendors(all.filter(v => v.category === category))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [category])

  async function handleAddVendor() {
    if (!couple || !category) return
    try {
      const vendor = await upsertVendor({ couple_id: couple.id, category, status: 'not_started' })
      setVendors(prev => [...prev, vendor])
      setEditingId(vendor.id)
      setEditForm({})
    } catch {
      alert('Failed to add vendor. Please try again.')
    }
  }

  async function handleSave(vendorId: string) {
    setSaving(true)
    try {
      await upsertVendor({ id: vendorId, couple_id: couple!.id, category: category!, ...editForm })
      setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(vendorId: string, status: VendorStatus) {
    try {
      await updateVendorStatus(vendorId, status)
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status } : v))
    } catch {
      alert('Failed to update status. Please try again.')
    }
  }

  async function handleDelete(vendorId: string) {
    if (!confirm('Remove this vendor?')) return
    try {
      await deleteVendor(vendorId)
      setVendors(prev => prev.filter(v => v.id !== vendorId))
    } catch {
      alert('Failed to remove vendor. Please try again.')
    }
  }

  const inputStyle: CSSProperties = {
    padding: '8px 10px', border: '1px solid var(--color-border)',
    fontFamily: 'var(--font-body)', fontSize: '13px',
    background: 'var(--color-surface)', width: '100%', boxSizing: 'border-box',
  }

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <button onClick={() => navigate('/vendors')} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px 0' }}>
        ← Vendors
      </button>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, marginBottom: '24px' }}>
        {VENDOR_CATEGORY_LABELS[category ?? ''] ?? category}
      </h1>

      {vendors.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          No vendors yet. Add one below or get AI suggestions.
        </p>
      )}

      {vendors.map(vendor => (
        <Card key={vendor.id} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', margin: '0 0 4px 0' }}>
                {vendor.name ?? 'Unnamed vendor'}
              </p>
              <StatusBadge status={vendor.status} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={vendor.status}
                onChange={e => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                style={{ padding: '4px 8px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '12px', background: 'var(--color-surface)' }}
              >
                <option value="not_started">Not Started</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="booked">Booked</option>
              </select>
              <button onClick={() => { setEditingId(vendor.id); setEditForm(vendor) }} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(vendor.id)} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-status-none)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>

          {editingId === vendor.id ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Name</label>
                <input style={inputStyle} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Booked Amount</label>
                <input type="number" style={inputStyle} value={editForm.booked_amount ?? ''} onChange={e => setEditForm(f => ({ ...f, booked_amount: Number(e.target.value) }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Contact Name</label>
                <input style={inputStyle} value={editForm.contact_name ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Contact Email</label>
                <input style={inputStyle} value={editForm.contact_email ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Website</label>
                <input style={inputStyle} value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Notes</label>
                <input style={inputStyle} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={() => handleSave(vendor.id)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {vendor.contact_name && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Contact: {vendor.contact_name}</p>}
              {vendor.contact_email && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{vendor.contact_email}</p>}
              {vendor.booked_amount && <p style={{ fontSize: '12px', color: 'var(--color-text-primary)', margin: 0, fontFamily: 'var(--font-heading)' }}>${vendor.booked_amount.toLocaleString()}</p>}
              {vendor.website && <a href={vendor.website} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--color-accent)' }}>{vendor.website}</a>}
              {vendor.notes && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, gridColumn: '1 / -1' }}>{vendor.notes}</p>}
            </div>
          )}
        </Card>
      ))}

      <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
        <Button variant="secondary" onClick={handleAddVendor}>
          + Add Vendor
        </Button>
      </div>
    </AppShell>
  )
}
