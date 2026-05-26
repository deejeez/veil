import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, upsertVendor, updateVendorStatus, deleteVendor } from '../lib/vendors'
import { type Couple, type Vendor, type VendorStatus, type VendorCategory, VENDOR_CATEGORY_LABELS } from '../types/database'
import type { AiReview, AiReviewFlag, Payment } from '../types/database'
import { track } from '../lib/analytics'
import { getPaymentsForVendor, insertPayment, markPaymentPaid, deletePayment } from '../lib/payments'

// ─── Design helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:            { bg: '#e8f5e9', color: '#2e7d32', label: 'Booked' },
  shortlisted:       { bg: '#fce4ec', color: '#b5506a', label: 'Shortlisted' },
  meeting_scheduled: { bg: '#fff3e0', color: '#c25a00', label: 'Meeting' },
  researching:       { bg: '#f0edff', color: '#6b4ec2', label: 'Researching' },
  not_started:       { bg: '#f5f5f5', color: '#888',    label: 'Not started' },
  eliminated:        { bg: '#fbe9e7', color: '#bf360c', label: 'Eliminated' },
}

const AV_COLORS = ['#c4788a', '#5c9e8c', '#7a8ec4', '#c4a45c', '#8e7ab5', '#c47a5c', '#5a9cc4']

function avColor(name: string) {
  return AV_COLORS[name.charCodeAt(0) % AV_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendorDetail() {
  const { category } = useParams<{ category: string }>()
  const navigate = useNavigate()

  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Vendor>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shortlist, setShortlist] = useState<{ name: string; address: string; website?: string; reason: string }[]>([])
  const [shortlistLoading, setShortlistLoading] = useState(false)
  const [shortlistError, setShortlistError] = useState<string | null>(null)
  const [shortlistExpanded, setShortlistExpanded] = useState(false)
  const [contracts, setContracts] = useState<{ id: string; vendor_id: string; file_name: string; ai_review: AiReview | null }[]>([])
  const [uploadingContract, setUploadingContract] = useState(false)
  const [reviewingContractId, setReviewingContractId] = useState<string | null>(null)
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ vendorId: string; status: VendorStatus; note: string } | null>(null)
  const [vendorPayments, setVendorPayments] = useState<Record<string, Payment[]>>({})
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null)
  const [newVendorPayment, setNewVendorPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple' })
  const [savingVendorPayment, setSavingVendorPayment] = useState(false)

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const all = await getVendorsForCouple(c.id)
      setVendors(all.filter(v => v.category === category))
      const { data: contractData } = await supabase
        .from('contracts')
        .select('id, vendor_id, file_name, ai_review')
        .eq('couple_id', c.id)
      setContracts((contractData ?? []) as { id: string; vendor_id: string; file_name: string; ai_review: AiReview | null }[])
      const bookedVendors = all.filter(v => v.category === category && v.status === 'booked')
      if (bookedVendors.length > 0) {
        const paymentResults = await Promise.all(bookedVendors.map(v => getPaymentsForVendor(v.id)))
        const paymentMap: Record<string, Payment[]> = {}
        bookedVendors.forEach((v, i) => { paymentMap[v.id] = paymentResults[i] })
        setVendorPayments(paymentMap)
      }
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
      setExpandedId(vendor.id)
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
    if (status === 'booked' || status === 'eliminated') {
      setNoteModal({ vendorId, status, note: '' })
      return
    }
    try {
      await updateVendorStatus(vendorId, status)
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status } : v))
    } catch {
      alert('Failed to update status. Please try again.')
    }
  }

  async function handleStatusWithNote() {
    if (!noteModal) return
    const { vendorId, status, note } = noteModal
    try {
      await updateVendorStatus(vendorId, status)
      if (note.trim()) {
        const { supabase: sb } = await import('../lib/supabase')
        const vendor = vendors.find(v => v.id === vendorId)
        if (vendor) {
          const existingNote = vendor.notes ? vendor.notes + '\n\n' : ''
          const label = status === 'booked' ? '✓ Booked: ' : '✕ Eliminated: '
          await sb.from('vendors').update({ notes: existingNote + label + note }).eq('id', vendorId)
        }
      }
      setVendors(prev => prev.map(v => v.id === vendorId ? {
        ...v,
        status,
        notes: note.trim()
          ? ((v.notes ? v.notes + '\n\n' : '') + (status === 'booked' ? '✓ Booked: ' : '✕ Eliminated: ') + note)
          : v.notes
      } : v))
      setNoteModal(null)
      if (status === 'booked') await load()
    } catch {
      alert('Failed to update status. Please try again.')
    }
  }

  async function handleDelete(vendorId: string) {
    if (!confirm('Remove this vendor?')) return
    try {
      await deleteVendor(vendorId)
      setVendors(prev => prev.filter(v => v.id !== vendorId))
      if (expandedId === vendorId) setExpandedId(null)
    } catch {
      alert('Failed to remove vendor. Please try again.')
    }
  }

  async function handleGetShortlist() {
    if (!couple) return
    setShortlistLoading(true)
    setShortlistError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('vendor-shortlist', {
        body: { couple_id: couple.id, category },
      })
      if (fnError) {
        const msg = (data as { error?: string } | null)?.error || fnError.message || "Couldn't generate suggestions"
        setShortlistError(msg)
        return
      }
      const vendors = (data as { vendors?: typeof shortlist })?.vendors ?? []
      if (vendors.length === 0) {
        setShortlistError('No suggestions found for your location. Make sure your city is set in your profile.')
        return
      }
      setShortlist(vendors)
      setShortlistExpanded(true)
      track('shortlist_generated', { category })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't generate suggestions — try again"
      setShortlistError(msg)
    } finally {
      setShortlistLoading(false)
    }
  }

  async function handleContractUpload(vendorId: string, file: File) {
    if (!couple) return
    if (file.size > 25 * 1024 * 1024) { alert('File too large. Maximum 25MB.'); return }
    setUploadingContract(true)
    try {
      const filePath = `${couple.id}/${vendorId}/${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: contractRow, error: insertError } = await supabase
        .from('contracts')
        .insert({ couple_id: couple.id, vendor_id: vendorId, file_path: filePath, file_name: file.name })
        .select()
        .single()
      if (insertError) throw insertError

      setContracts(prev => [...prev, { id: contractRow.id, vendor_id: vendorId, file_name: file.name, ai_review: null }])
      setReviewingContractId(contractRow.id)
      const { data, error: fnError } = await supabase.functions.invoke('contract-review', {
        body: { contract_id: contractRow.id },
      })
      if (fnError) throw fnError
      setContracts(prev => prev.map(c => c.id === contractRow.id ? { ...c, ai_review: data } : c))
      track('contract_uploaded', { category })
    } catch (err: unknown) {
      alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingContract(false)
      setReviewingContractId(null)
    }
  }

  async function handleAddVendorPayment(vendorId: string) {
    if (!couple) return
    setSavingVendorPayment(true)
    try {
      await insertPayment({
        couple_id: couple.id,
        vendor_id: vendorId,
        label: newVendorPayment.label,
        amount: Number(newVendorPayment.amount),
        due_date: newVendorPayment.due_date || null,
        paid_date: null,
        paid_by: newVendorPayment.paid_by,
        notes: null,
      })
      setAddingPaymentFor(null)
      setNewVendorPayment({ label: '', amount: '', due_date: '', paid_by: 'couple' })
      await load()
    } catch {
      alert('Failed to add payment. Please try again.')
    } finally {
      setSavingVendorPayment(false)
    }
  }

  async function handleMarkVendorPaymentPaid(paymentId: string) {
    try {
      await markPaymentPaid(paymentId, new Date().toISOString().split('T')[0])
      await load()
    } catch {
      alert('Failed to mark payment as paid. Please try again.')
    }
  }

  async function handleDeleteVendorPayment(paymentId: string) {
    if (!confirm('Remove this payment?')) return
    try {
      await deletePayment(paymentId)
      await load()
    } catch {
      alert('Failed to remove payment. Please try again.')
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const booked    = vendors.filter(v => v.status === 'booked')
  const inProgress = vendors.filter(v => ['researching', 'shortlisted', 'meeting_scheduled'].includes(v.status))
  const notStarted = vendors.filter(v => v.status === 'not_started')
  const eliminated = vendors.filter(v => v.status === 'eliminated')
  const visible   = vendors.filter(v => v.status !== 'eliminated')

  const familyAName = couple?.family_a_name || 'Family A'
  const familyBName = couple?.family_b_name || 'Family B'

  function paidByLabel(key: string) {
    if (key === 'family_a') return familyAName
    if (key === 'family_b') return familyBName
    return 'Couple'
  }

  // ─── Payment schedule sub-render ─────────────────────────────────────────────

  function renderPaymentSchedule(vendor: Vendor) {
    const todayStr = new Date().toISOString().split('T')[0]
    const payments = vendorPayments[vendor.id] ?? []

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '7px', fontWeight: 700 }}>
          Payment Schedule
        </div>
        {payments.length === 0 && (
          <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '6px' }}>No payments yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {payments.map(p => {
            const isOverdue = !!p.due_date && p.due_date < todayStr && !p.paid_date
            const isPaid = !!p.paid_date
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', background: isPaid ? '#f0faf0' : isOverdue ? '#fff5f5' : '#fafafa', border: `1px solid ${isPaid ? '#a5d6a7' : isOverdue ? '#fcd5d5' : '#e5e0d8'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#2c2825' }}>{p.label}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    ${p.amount.toLocaleString()}
                    {p.due_date ? ` · Due ${new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    {isPaid ? ' · Paid ✓' : ''}
                    {p.paid_by ? ` · ${paidByLabel(p.paid_by)}` : ''}
                  </div>
                </div>
                {!isPaid && (
                  <button
                    onClick={() => handleMarkVendorPaymentPaid(p.id)}
                    style={{ fontSize: '10px', border: `1px solid ${isOverdue ? '#c0392b' : '#e5e0d8'}`, borderRadius: '5px', padding: '2px 7px', color: isOverdue ? '#c0392b' : '#888', background: 'none', cursor: 'pointer' }}
                  >Pay</button>
                )}
                <button
                  onClick={() => handleDeleteVendorPayment(p.id)}
                  style={{ fontSize: '11px', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                >✕</button>
              </div>
            )
          })}
        </div>

        {addingPaymentFor === vendor.id ? (
          <div style={{ marginTop: '8px', padding: '10px 12px', border: '1px solid #e5e0d8', borderRadius: '8px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Label</label>
                <input placeholder="Deposit" value={newVendorPayment.label} onChange={e => setNewVendorPayment(f => ({ ...f, label: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Amount ($)</label>
                <input type="number" value={newVendorPayment.amount} onChange={e => setNewVendorPayment(f => ({ ...f, amount: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Due Date</label>
                <input type="date" value={newVendorPayment.due_date} onChange={e => setNewVendorPayment(f => ({ ...f, due_date: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Paid By</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(['couple', 'family_a', 'family_b'] as const).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewVendorPayment(f => ({ ...f, paid_by: key }))}
                      style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', border: `1px solid ${newVendorPayment.paid_by === key ? '#c4788a' : '#e5e0d8'}`, background: newVendorPayment.paid_by === key ? '#fdf0f2' : '#fff', color: newVendorPayment.paid_by === key ? '#c4788a' : '#888', cursor: 'pointer', fontWeight: newVendorPayment.paid_by === key ? 600 : 400 }}
                    >
                      {key === 'couple' ? 'Couple' : key === 'family_a' ? familyAName : familyBName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => { setAddingPaymentFor(null); setNewVendorPayment({ label: '', amount: '', due_date: '', paid_by: 'couple' }) }}>Cancel</Button>
              <Button onClick={() => handleAddVendorPayment(vendor.id)} disabled={savingVendorPayment || !newVendorPayment.label || !newVendorPayment.amount}>
                {savingVendorPayment ? 'Saving...' : 'Add'}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingPaymentFor(vendor.id)}
            style={{ marginTop: '6px', fontSize: '12px', color: '#c4788a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            + Add payment
          </button>
        )}
      </div>
    )
  }

  // ─── Contract section sub-render ─────────────────────────────────────────────

  function renderContractSection(vendor: Vendor) {
    const vendorContracts = contracts.filter(c => c.vendor_id === vendor.id)
    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '7px', fontWeight: 700 }}>
          Contract Review
        </div>
        {vendorContracts.length === 0 && (
          <label style={{ cursor: uploadingContract ? 'default' : 'pointer' }}>
            <input type="file" accept=".pdf" style={{ display: 'none' }} disabled={uploadingContract} onChange={e => { const f = e.target.files?.[0]; if (f) handleContractUpload(vendor.id, f) }} />
            <span style={{ fontSize: '13px', color: '#c4788a', textDecoration: 'underline', cursor: uploadingContract ? 'default' : 'pointer' }}>
              {uploadingContract ? 'Uploading & reviewing...' : '+ Upload Contract PDF'}
            </span>
          </label>
        )}
        {vendorContracts.map(c => (
          <div key={c.id}>
            <p style={{ fontSize: '13px', margin: '0 0 8px 0' }}>
              📄 {c.file_name}
              {reviewingContractId === c.id && <span style={{ color: '#aaa', marginLeft: '8px', fontStyle: 'italic' }}>Reviewing...</span>}
            </p>
            {c.ai_review?.status === 'complete' && (
              <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontStyle: 'italic', color: '#2c2825', marginBottom: '12px', lineHeight: 1.5 }}>
                  {c.ai_review.summary}
                </p>
                {c.ai_review.flags.map((flag: AiReviewFlag, i: number) => {
                  const key = `${c.id}-${i}`
                  const severityColor: Record<string, string> = { flag: '#B91C1C', caution: '#c25a00', info: '#aaa' }
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <button
                        onClick={() => setExpandedFlag(expandedFlag === key ? null : key)}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      >
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: severityColor[flag.severity], fontWeight: 700 }}>{flag.severity}</span>
                        <span style={{ fontSize: '13px', color: '#2c2825' }}>{flag.clause}</span>
                        <span style={{ color: '#aaa', fontSize: '11px' }}>{expandedFlag === key ? '▲' : '▼'}</span>
                      </button>
                      {expandedFlag === key && (
                        <p style={{ fontSize: '13px', color: '#888', margin: '6px 0 0 0', lineHeight: 1.5 }}>{flag.text}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      {/* Back */}
      <button
        onClick={() => navigate('/vendors')}
        style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px 0' }}
      >
        ← Vendors
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, margin: '0 0 8px 0', color: '#2c2825' }}>
            {VENDOR_CATEGORY_LABELS[category as VendorCategory] ?? category}
          </h1>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {booked.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}>
                {booked.length} Booked
              </span>
            )}
            {inProgress.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#fce4ec', color: '#b5506a', fontWeight: 600 }}>
                {inProgress.length} Active
              </span>
            )}
            {notStarted.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#f5f5f5', color: '#888', fontWeight: 600 }}>
                {notStarted.length} To do
              </span>
            )}
            {vendors.length === 0 && (
              <span style={{ fontSize: '12px', color: '#bbb' }}>No vendors yet</span>
            )}
          </div>
        </div>
        <button
          onClick={handleAddVendor}
          style={{ fontSize: '13px', color: '#c4788a', border: '1.5px solid #c4788a', borderRadius: '8px', padding: '6px 16px', background: 'none', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-body)' }}
        >
          + Add Vendor
        </button>
      </div>

      {/* AI Shortlist CTA — dark card, prominent */}
      <div style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #2c2825 0%, #3d3330 100%)', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px', fontWeight: 600 }}>
            AI Advisor
          </div>
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
            {shortlistLoading
              ? 'Finding the best vendors in your area...'
              : shortlist.length > 0
                ? `${shortlist.length} suggestions ready — ranked for your vibe`
                : 'Get 4–6 vendors ranked against your wedding vibe profile'}
          </div>
          {shortlistError && <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>{shortlistError}</div>}
        </div>
        <button
          onClick={handleGetShortlist}
          disabled={shortlistLoading}
          style={{ fontSize: '12px', fontWeight: 600, padding: '7px 16px', borderRadius: '8px', background: '#c4788a', color: '#fff', border: 'none', cursor: shortlistLoading ? 'default' : 'pointer', flexShrink: 0, opacity: shortlistLoading ? 0.7 : 1 }}
        >
          {shortlistLoading ? 'Finding...' : shortlist.length > 0 ? 'Refresh' : 'Get Shortlist'}
        </button>
      </div>

      {/* Shortlist results (collapsible) */}
      {shortlist.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <button
            onClick={() => setShortlistExpanded(e => !e)}
            style={{ fontSize: '11px', color: '#c4788a', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0', fontWeight: 600 }}
          >
            {shortlistExpanded ? '▲ Hide' : '▼ Show'} {shortlist.length} AI suggestions
          </button>
          {shortlistExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shortlist.map((v, i) => (
                <div key={i} style={{ padding: '10px 14px', border: '1px solid #e5e0d8', borderRadius: '10px', background: '#fafafa', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2825', marginBottom: '2px' }}>{v.name}</div>
                    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '3px' }}>{v.address}</div>
                    <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>{v.reason}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!couple) return
                      try {
                        const vendor = await upsertVendor({ couple_id: couple.id, category: category!, name: v.name, website: v.website, status: 'shortlisted' })
                        setVendors(prev => [...prev, vendor])
                      } catch {
                        alert('Failed to add vendor.')
                      }
                    }}
                    style={{ fontSize: '12px', color: '#c4788a', border: '1px solid #c4788a', borderRadius: '6px', padding: '4px 12px', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Add →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#bbb', fontSize: '14px' }}>
          No vendors yet — add one or use AI to get suggestions.
        </div>
      )}

      {/* Vendor tile list */}
      <div style={{ display: 'flex', flexDirection: 'column', border: visible.length > 0 ? '1px solid #e5e0d8' : 'none', borderRadius: '10px', overflow: 'hidden', background: '#fff', boxShadow: visible.length > 0 ? '0 1px 4px rgba(0,0,0,0.05)' : 'none' }}>
        {visible.map((vendor, idx) => {
          const isExpanded = expandedId === vendor.id
          const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.not_started
          const displayName = vendor.name || 'Unnamed vendor'
          const isEditing = editingId === vendor.id
          const isLast = idx === visible.length - 1

          return (
            <div key={vendor.id} style={{ borderBottom: isLast ? 'none' : '1px solid #f0ede8' }}>

              {/* Tile row */}
              <div
                onClick={() => { setExpandedId(isExpanded ? null : vendor.id); setEditingId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer', background: isExpanded ? '#faf7f4' : '#fff', transition: 'background 0.1s' }}
              >
                {/* Avatar circle */}
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avColor(displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{initials(displayName)}</span>
                </div>

                {/* Name + sub */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#2c2825', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName}
                  </div>
                  {vendor.contact_name && (
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{vendor.contact_name}</div>
                  )}
                </div>

                {/* Right side: status chip + amount + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {cfg.label}
                  </span>
                  {vendor.booked_amount != null && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-heading)' }}>
                      ${vendor.booked_amount.toLocaleString()}
                    </span>
                  )}
                  <span style={{ fontSize: '16px', color: '#bbb', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid #f0ede8', background: '#faf7f4' }}>
                  {isEditing ? (
                    /* Edit form */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Name</label>
                        <input style={{ display: 'block' }} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Booked Amount</label>
                        <input type="number" style={{ display: 'block' }} value={editForm.booked_amount ?? ''} onChange={e => setEditForm(f => ({ ...f, booked_amount: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Contact Name</label>
                        <input style={{ display: 'block' }} value={editForm.contact_name ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Email</label>
                        <input style={{ display: 'block' }} value={editForm.contact_email ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Phone</label>
                        <input style={{ display: 'block' }} value={editForm.contact_phone ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Website</label>
                        <input style={{ display: 'block' }} value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Notes</label>
                        <textarea
                          style={{ display: 'block', width: '100%', minHeight: '60px', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                          value={editForm.notes ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button onClick={() => handleSave(vendor.id)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                      </div>
                    </div>
                  ) : (
                    /* Details view */
                    <>
                      {(vendor.contact_email || vendor.contact_phone || vendor.website || vendor.booked_amount != null) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '12px' }}>
                          {vendor.contact_email && (
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Email</div>
                              <div style={{ fontSize: '13px', color: '#2c2825' }}>{vendor.contact_email}</div>
                            </div>
                          )}
                          {vendor.contact_phone && (
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Phone</div>
                              <div style={{ fontSize: '13px', color: '#2c2825' }}>{vendor.contact_phone}</div>
                            </div>
                          )}
                          {vendor.website && (
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Website</div>
                              <a href={vendor.website} target="_blank" rel="noopener" style={{ fontSize: '13px', color: '#c4788a' }}>{vendor.website}</a>
                            </div>
                          )}
                          {vendor.booked_amount != null && (
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Booked Amount</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-heading)' }}>${vendor.booked_amount.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {vendor.notes && (
                        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: '#f0ede8', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                          {vendor.notes}
                        </div>
                      )}
                    </>
                  )}

                  {/* Booked extras: payment schedule + contract */}
                  {vendor.status === 'booked' && !isEditing && (
                    <>
                      {renderPaymentSchedule(vendor)}
                      {renderContractSection(vendor)}
                    </>
                  )}

                  {/* Action row */}
                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #ede8e2', flexWrap: 'wrap' }}>
                      <select
                        value={vendor.status}
                        onChange={e => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                        style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #e5e0d8', background: '#fff', color: '#2c2825', flex: '0 0 auto' }}
                      >
                        <option value="not_started">Not Started</option>
                        <option value="researching">Researching</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="meeting_scheduled">Meeting Scheduled</option>
                        <option value="booked">Booked ✓</option>
                        <option value="eliminated">Eliminated ✕</option>
                      </select>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => { setEditingId(vendor.id); setEditForm(vendor) }} style={{ fontSize: '12px', color: '#c4788a', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Edit</button>
                      <button onClick={() => handleDelete(vendor.id)} style={{ fontSize: '12px', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Remove</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Eliminated — collapsed by default */}
      {eliminated.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <details>
            <summary style={{ fontSize: '12px', color: '#aaa', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
              {eliminated.length} eliminated vendor{eliminated.length !== 1 ? 's' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {eliminated.map(vendor => (
                <div key={vendor.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#f5f0ef', border: '1px solid #e8e0dc', opacity: 0.75 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#d0c8c5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{initials(vendor.name || 'UN')}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#999' }}>{vendor.name || 'Unnamed vendor'}</div>
                  <button onClick={() => handleDelete(vendor.id)} style={{ fontSize: '11px', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Decision note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 6px 0' }}>
              {noteModal.status === 'booked' ? 'Booking confirmed!' : 'Mark as eliminated'}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 18px 0' }}>
              {noteModal.status === 'booked'
                ? 'Add a note about why you chose this vendor (optional).'
                : 'Add a note about why you eliminated this vendor (optional).'}
            </p>
            <textarea
              autoFocus
              placeholder={noteModal.status === 'booked' ? 'e.g. Best portfolio, great vibe at the tasting...' : 'e.g. Too expensive, already booked...'}
              value={noteModal.note}
              onChange={e => setNoteModal(m => m ? { ...m, note: e.target.value } : m)}
              style={{ width: '100%', minHeight: '80px', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', display: 'block', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setNoteModal(null)}>Cancel</Button>
              <Button onClick={handleStatusWithNote} style={{ background: noteModal.status === 'booked' ? 'var(--color-status-booked)' : undefined }}>
                {noteModal.status === 'booked' ? 'Confirm Booking' : 'Eliminate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
