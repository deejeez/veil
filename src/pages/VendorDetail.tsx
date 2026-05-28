import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, upsertVendor, updateVendorStatus, deleteVendor } from '../lib/vendors'
import { type Couple, type Vendor, type VendorStatus, type VendorNote } from '../types/database'
import { getCategoriesForCouple } from '../lib/categories'
import type { AiReview, AiReviewFlag, Payment } from '../types/database'
import { track } from '../lib/analytics'
import { getPaymentsForVendor, insertPayment, markPaymentPaid, deletePayment } from '../lib/payments'
import { getVendorNotes, addVendorNote, deleteVendorNote } from '../lib/vendorNotes'

// ─── Design helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:            { bg: '#EFF4EC', color: '#5A7A4A', label: 'Booked' },
  shortlisted:       { bg: 'rgba(184,146,106,0.10)', color: 'var(--color-accent)', label: 'Shortlisted' },
  meeting_scheduled: { bg: '#FBF6F0', color: '#C4785C', label: 'Meeting' },
  researching:       { bg: '#F5F1EC', color: 'var(--color-text-secondary)', label: 'Researching' },
  not_started:       { bg: '#F5F1EC', color: 'var(--color-text-muted)',    label: 'Not started' },
  eliminated:        { bg: '#F5F1EC', color: 'var(--color-text-muted)', label: 'Eliminated' },
}

const AV_COLORS = ['#B8926A', '#5c9e8c', '#7a8ec4', '#c4a45c', '#8e7ab5', '#c47a5c', '#5a9cc4']

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
  const [contracts, setContracts] = useState<{ id: string; vendor_id: string; file_path: string; file_name: string; document_type: 'contract' | 'proposal'; ai_review: AiReview | null }[]>([])
  const [uploadingContract, setUploadingContract] = useState(false)
  const [reviewingContractId, setReviewingContractId] = useState<string | null>(null)
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, VendorNote[]>>({})
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const contractInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [noteModal, setNoteModal] = useState<{ vendorId: string; status: VendorStatus; note: string } | null>(null)
  const [vendorPayments, setVendorPayments] = useState<Record<string, Payment[]>>({})
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null)
  const [newVendorPayment, setNewVendorPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple' })
  const [savingVendorPayment, setSavingVendorPayment] = useState(false)
  const [categoryLabel, setCategoryLabel] = useState<string>(category ?? '')

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const c = await getCoupleForUser(user.id)
      if (!c) return
      setCouple(c)
      const cats = await getCategoriesForCouple(c.id)
      const found = cats.find(cat => cat.slug === category)
      if (found) setCategoryLabel(found.label)
      const all = await getVendorsForCouple(c.id)
      setVendors(all.filter(v => v.category === category))
      const { data: contractData } = await supabase
        .from('contracts')
        .select('id, vendor_id, file_path, file_name, document_type, ai_review')
        .eq('couple_id', c.id)
      setContracts((contractData ?? []) as { id: string; vendor_id: string; file_path: string; file_name: string; document_type: 'contract' | 'proposal'; ai_review: AiReview | null }[])
      const allVendors = all.filter(v => v.category === category)
      const notesResults = await Promise.all(allVendors.map(v => getVendorNotes(v.id)))
      const notesMap: Record<string, VendorNote[]> = {}
      allVendors.forEach((v, i) => { notesMap[v.id] = notesResults[i] })
      setNotes(notesMap)
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
        let msg = "Couldn't generate suggestions"
        try {
          // Supabase SDK v2: FunctionsHttpError stores the Response on .context
          const errBody = await (fnError as { context?: Response }).context?.json?.()
          msg = (errBody as { message?: string; error?: string })?.message
            || (errBody as { message?: string; error?: string })?.error
            || fnError.message
            || msg
        } catch {
          msg = fnError.message || msg
        }
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

  async function handleDocumentUpload(vendorId: string, file: File, documentType: 'contract' | 'proposal') {
    if (!couple) return
    if (file.size > 25 * 1024 * 1024) { alert('File too large. Maximum 25MB.'); return }
    setUploadingContract(true)
    try {
      const filePath = `${couple.id}/${vendorId}/${documentType}/${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: contractRow, error: insertError } = await supabase
        .from('contracts')
        .insert({ couple_id: couple.id, vendor_id: vendorId, file_path: filePath, file_name: file.name, document_type: documentType })
        .select()
        .single()
      if (insertError) throw insertError

      setContracts(prev => [...prev, { id: contractRow.id, vendor_id: vendorId, file_path: filePath, file_name: file.name, document_type: documentType, ai_review: null }])

      if (documentType === 'contract') {
        setReviewingContractId(contractRow.id)
        const { data, error: fnError } = await supabase.functions.invoke('contract-review', {
          body: { contract_id: contractRow.id },
        })
        if (fnError) throw fnError
        setContracts(prev => prev.map(c => c.id === contractRow.id ? { ...c, ai_review: data } : c))
      }

      track('contract_uploaded', { category, documentType })
    } catch (err: unknown) {
      alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingContract(false)
      setReviewingContractId(null)
    }
  }

  async function handleDeleteDocument(contractId: string, filePath: string) {
    if (!confirm('Remove this document?')) return
    try {
      await supabase.storage.from('contracts').remove([filePath])
      await supabase.from('contracts').delete().eq('id', contractId)
      setContracts(prev => prev.filter(c => c.id !== contractId))
    } catch (err: unknown) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function handleGetSignedUrl(filePath: string) {
    const { data } = await supabase.storage.from('contracts').createSignedUrl(filePath, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleAddNote(vendorId: string) {
    if (!couple) return
    const text = (noteText[vendorId] ?? '').trim()
    if (!text) return
    setSavingNote(vendorId)
    try {
      const note = await addVendorNote({ couple_id: couple.id, vendor_id: vendorId, text })
      setNotes(prev => ({ ...prev, [vendorId]: [note, ...(prev[vendorId] ?? [])] }))
      setNoteText(prev => ({ ...prev, [vendorId]: '' }))
    } catch {
      alert('Failed to add note. Please try again.')
    } finally {
      setSavingNote(null)
    }
  }

  async function handleDeleteNote(vendorId: string, noteId: string) {
    try {
      await deleteVendorNote(noteId)
      setNotes(prev => ({ ...prev, [vendorId]: (prev[vendorId] ?? []).filter(n => n.id !== noteId) }))
    } catch {
      alert('Failed to delete note. Please try again.')
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
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '7px', fontWeight: 700 }}>
          Payment Schedule
        </div>
        {payments.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>No payments yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {payments.map(p => {
            const isOverdue = !!p.due_date && p.due_date < todayStr && !p.paid_date
            const isPaid = !!p.paid_date
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '7px', background: isPaid ? '#EFF4EC' : isOverdue ? 'rgba(196,120,92,0.06)' : 'var(--color-bg)', border: `1px solid ${isPaid ? '#C8DCBE' : isOverdue ? 'rgba(196,120,92,0.25)' : 'var(--color-border)'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#2c2825' }}>{p.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    ${p.amount.toLocaleString()}
                    {p.due_date ? ` · Due ${new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    {isPaid ? ' · Paid ✓' : ''}
                    {p.paid_by ? ` · ${paidByLabel(p.paid_by)}` : ''}
                  </div>
                </div>
                {!isPaid && (
                  <button
                    onClick={() => handleMarkVendorPaymentPaid(p.id)}
                    style={{ fontSize: '10px', border: `1px solid ${isOverdue ? '#C4785C' : 'var(--color-border)'}`, borderRadius: '5px', padding: '2px 7px', color: isOverdue ? '#C4785C' : 'var(--color-text-muted)', background: 'none', cursor: 'pointer' }}
                  >Pay</button>
                )}
                <button
                  onClick={() => handleDeleteVendorPayment(p.id)}
                  style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                >✕</button>
              </div>
            )
          })}
        </div>

        {addingPaymentFor === vendor.id ? (
          <div style={{ marginTop: '8px', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Label</label>
                <input placeholder="Deposit" value={newVendorPayment.label} onChange={e => setNewVendorPayment(f => ({ ...f, label: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Amount ($)</label>
                <input type="number" value={newVendorPayment.amount} onChange={e => setNewVendorPayment(f => ({ ...f, amount: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Due Date</label>
                <input type="date" value={newVendorPayment.due_date} onChange={e => setNewVendorPayment(f => ({ ...f, due_date: e.target.value }))} style={{ display: 'block', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Paid By</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(['couple', 'family_a', 'family_b'] as const).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewVendorPayment(f => ({ ...f, paid_by: key }))}
                      style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '20px', border: `1px solid ${newVendorPayment.paid_by === key ? 'var(--color-accent)' : 'var(--color-border)'}`, background: newVendorPayment.paid_by === key ? 'var(--color-sidebar-active)' : '#fff', color: newVendorPayment.paid_by === key ? 'var(--color-accent)' : 'var(--color-text-muted)', cursor: 'pointer', fontWeight: newVendorPayment.paid_by === key ? 600 : 400 }}
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
            style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            + Add payment
          </button>
        )}
      </div>
    )
  }

  // ─── Documents section sub-render ────────────────────────────────────────────

  function renderDocumentsSection(vendor: Vendor) {
    const vendorDocs = contracts.filter(c => c.vendor_id === vendor.id)
    const vendorContracts = vendorDocs.filter(c => c.document_type === 'contract')
    const vendorProposals = vendorDocs.filter(c => c.document_type === 'proposal')

    function renderDocRow(doc: typeof vendorDocs[0]) {
      const truncated = doc.file_name.length > 40 ? doc.file_name.slice(0, 37) + '...' : doc.file_name
      const reviewing = reviewingContractId === doc.id
      return (
        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '13px', flex: 1, color: '#2c2825' }}>📄 {truncated}</span>
          {reviewing && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Reviewing...</span>}
          {doc.ai_review?.status === 'complete' && (
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#EFF4EC', color: '#5A7A4A', fontWeight: 600 }}>AI Reviewed</span>
          )}
          <button
            onClick={() => handleGetSignedUrl(doc.file_path)}
            style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >View</button>
          <button
            onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
            style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >Delete</button>
        </div>
      )
    }

    function renderAiReview(doc: typeof vendorDocs[0]) {
      if (!doc.ai_review || doc.ai_review.status !== 'complete') return null
      return (
        <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', marginTop: '8px' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontStyle: 'italic', color: '#2c2825', marginBottom: '12px', lineHeight: 1.5 }}>
            {doc.ai_review.summary}
          </p>
          {doc.ai_review.flags.map((flag: AiReviewFlag, i: number) => {
            const key = `${doc.id}-${i}`
            const severityColor: Record<string, string> = { flag: '#C4785C', caution: '#C4785C', info: 'var(--color-text-muted)' }
            return (
              <div key={i} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => setExpandedFlag(expandedFlag === key ? null : key)}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: severityColor[flag.severity], fontWeight: 700 }}>{flag.severity}</span>
                  <span style={{ fontSize: '13px', color: '#2c2825' }}>{flag.clause}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{expandedFlag === key ? '▲' : '▼'}</span>
                </button>
                {expandedFlag === key && (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '6px 0 0 0', lineHeight: 1.5 }}>{flag.text}</p>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px', fontWeight: 700 }}>
          Documents
        </div>

        {/* Upload buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              disabled={uploadingContract}
              ref={el => { contractInputRefs.current[`${vendor.id}-contract`] = el }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(vendor.id, f, 'contract') }}
            />
            <span
              onClick={() => contractInputRefs.current[`${vendor.id}-contract`]?.click()}
              style={{ display: 'inline-block', fontSize: '12px', padding: '5px 14px', borderRadius: '7px', background: 'var(--color-accent)', color: '#fff', cursor: uploadingContract ? 'default' : 'pointer', opacity: uploadingContract ? 0.6 : 1, fontFamily: 'var(--font-body)', fontWeight: 600 }}
            >
              {uploadingContract ? 'Uploading...' : '+ Upload Contract'}
            </span>
          </label>
          <label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              disabled={uploadingContract}
              ref={el => { contractInputRefs.current[`${vendor.id}-proposal`] = el }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(vendor.id, f, 'proposal') }}
            />
            <span
              onClick={() => contractInputRefs.current[`${vendor.id}-proposal`]?.click()}
              style={{ display: 'inline-block', fontSize: '12px', padding: '5px 14px', borderRadius: '7px', border: '1.5px solid var(--color-accent)', color: 'var(--color-accent)', cursor: uploadingContract ? 'default' : 'pointer', opacity: uploadingContract ? 0.6 : 1, fontFamily: 'var(--font-body)', fontWeight: 600, background: 'none' }}
            >
              + Upload Proposal
            </span>
          </label>
        </div>

        {/* Contracts group */}
        {vendorContracts.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: 600 }}>Contracts</div>
            {vendorContracts.map(doc => (
              <div key={doc.id}>
                {renderDocRow(doc)}
                {renderAiReview(doc)}
              </div>
            ))}
          </div>
        )}

        {/* Proposals group */}
        {vendorProposals.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: 600 }}>Proposals</div>
            {vendorProposals.map(doc => renderDocRow(doc))}
          </div>
        )}

        {vendorDocs.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>No documents yet.</p>
        )}
      </div>
    )
  }

  // ─── Notes section sub-render ─────────────────────────────────────────────────

  function renderNotesSection(vendor: Vendor) {
    const vendorNotes = notes[vendor.id] ?? []
    const text = noteText[vendor.id] ?? ''
    const isSaving = savingNote === vendor.id

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px', fontWeight: 700 }}>
          Notes
        </div>
        <textarea
          rows={3}
          placeholder="Add a note..."
          value={text}
          onChange={e => setNoteText(prev => ({ ...prev, [vendor.id]: e.target.value }))}
          style={{ display: 'block', width: '100%', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }}
        />
        <button
          onClick={() => handleAddNote(vendor.id)}
          disabled={isSaving || !text.trim()}
          style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '7px', background: isSaving || !text.trim() ? '#D4CFC8' : 'var(--color-accent)', color: '#fff', border: 'none', cursor: isSaving || !text.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: vendorNotes.length > 0 ? '12px' : 0 }}
        >
          {isSaving ? 'Adding...' : 'Add Note'}
        </button>

        {vendorNotes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vendorNotes.map(note => (
              <div key={note.id} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#2c2825', margin: '0 0 4px 0', lineHeight: 1.5 }}>{note.text}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(vendor.id, note.id)}
                  style={{ fontSize: '14px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, alignSelf: 'flex-start' }}
                >×</button>
              </div>
            ))}
          </div>
        )}
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
        style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px 0' }}
      >
        ← Vendors
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, margin: '0 0 8px 0', color: '#2c2825' }}>
            {categoryLabel}
          </h1>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {booked.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#EFF4EC', color: '#5A7A4A', fontWeight: 600 }}>
                {booked.length} Booked
              </span>
            )}
            {inProgress.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(184,146,106,0.10)', color: 'var(--color-accent)', fontWeight: 600 }}>
                {inProgress.length} Active
              </span>
            )}
            {notStarted.length > 0 && (
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#F5F1EC', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {notStarted.length} To do
              </span>
            )}
            {vendors.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No vendors yet</span>
            )}
          </div>
        </div>
        <button
          onClick={handleAddVendor}
          style={{ fontSize: '13px', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', borderRadius: '8px', padding: '6px 16px', background: 'none', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-body)' }}
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
          style={{ fontSize: '12px', fontWeight: 600, padding: '7px 16px', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: shortlistLoading ? 'default' : 'pointer', flexShrink: 0, opacity: shortlistLoading ? 0.7 : 1 }}
        >
          {shortlistLoading ? 'Finding...' : shortlist.length > 0 ? 'Refresh' : 'Get Shortlist'}
        </button>
      </div>

      {/* Shortlist results (collapsible) */}
      {shortlist.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <button
            onClick={() => setShortlistExpanded(e => !e)}
            style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px 0', fontWeight: 600 }}
          >
            {shortlistExpanded ? '▲ Hide' : '▼ Show'} {shortlist.length} AI suggestions
          </button>
          {shortlistExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shortlist.map((v, i) => (
                <div key={i} style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2825', marginBottom: '2px' }}>{v.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{v.address}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{v.reason}</div>
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
                    style={{ fontSize: '12px', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: '6px', padding: '4px 12px', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Add →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — 3 warm cards */}
      {visible.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {/* Card 1 — AI Recommendations */}
          <div style={{ background: '#FBF6F0', border: '1px solid var(--color-border)', borderLeft: '4px solid #B8926A', padding: '16px 18px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B8926A', marginBottom: '5px' }}>✦ Get AI Recommendations</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
              Find the best {categoryLabel} vendors in your area, ranked for your vibe profile.
            </p>
            <Button
              onClick={handleGetShortlist}
              disabled={shortlistLoading}
              style={{ fontSize: '12px', padding: '6px 16px', opacity: shortlistLoading ? 0.7 : 1 }}
            >
              {shortlistLoading ? 'Finding...' : 'Find Vendors'}
            </Button>
          </div>

          {/* Card 2 — Add a Vendor */}
          <div style={{ background: '#F8F5F1', border: '1px solid var(--color-border)', borderLeft: '4px solid #D4CFC8', padding: '16px 18px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>+ Add a Vendor</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <input
                id="empty-vendor-name"
                placeholder="Vendor name"
                style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              />
              <input
                id="empty-vendor-contact"
                placeholder="Contact name"
                style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              />
              <input
                id="empty-vendor-phone"
                placeholder="Phone"
                style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              />
            </div>
            <Button
              onClick={async () => {
                if (!couple || !category) return
                const name = (document.getElementById('empty-vendor-name') as HTMLInputElement)?.value.trim()
                const contact_name = (document.getElementById('empty-vendor-contact') as HTMLInputElement)?.value.trim()
                const contact_phone = (document.getElementById('empty-vendor-phone') as HTMLInputElement)?.value.trim()
                if (!name) return
                try {
                  const vendor = await upsertVendor({ couple_id: couple.id, category, status: 'researching', name, contact_name: contact_name || null, contact_phone: contact_phone || null })
                  setVendors(prev => [...prev, vendor])
                  setExpandedId(vendor.id)
                } catch {
                  alert('Failed to add vendor. Please try again.')
                }
              }}
              style={{ fontSize: '12px', padding: '6px 16px' }}
            >
              Save Vendor
            </Button>
          </div>

          {/* Card 3 — Upload a Proposal */}
          <div style={{ background: '#F8F5F1', border: '1px solid var(--color-border)', borderLeft: '4px solid #D4CFC8', padding: '16px 18px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>📄 Upload a Proposal</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
              Upload a proposal to keep everything in one place.
            </p>
            <label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                disabled={uploadingContract || !couple}
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (!f || !couple) return
                  // Create a placeholder vendor if none exist
                  let vendorId = vendors[0]?.id
                  if (!vendorId) {
                    const v = await upsertVendor({ couple_id: couple.id, category: category!, status: 'researching' })
                    setVendors([v])
                    vendorId = v.id
                  }
                  await handleDocumentUpload(vendorId, f, 'proposal')
                }}
              />
              <span style={{ display: 'inline-block', fontSize: '12px', padding: '6px 16px', borderRadius: '7px', border: '1.5px solid var(--color-accent)', color: 'var(--color-accent)', cursor: uploadingContract ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, opacity: uploadingContract ? 0.6 : 1 }}>
                {uploadingContract ? 'Uploading...' : 'Choose File'}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Vendor tile list */}
      <div style={{ display: 'flex', flexDirection: 'column', border: visible.length > 0 ? '1px solid var(--color-border)' : 'none', borderRadius: '8px', overflow: 'hidden', background: '#fff', boxShadow: visible.length > 0 ? '0 1px 4px rgba(0,0,0,0.05)' : 'none' }}>
        {visible.map((vendor, idx) => {
          const isExpanded = expandedId === vendor.id
          const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.not_started
          const displayName = vendor.name || 'Unnamed vendor'
          const isEditing = editingId === vendor.id
          const isLast = idx === visible.length - 1

          return (
            <div key={vendor.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>

              {/* Tile row */}
              <div
                onClick={() => { setExpandedId(isExpanded ? null : vendor.id); setEditingId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer', background: isExpanded ? '#F5F1EC' : '#fff', transition: 'background 0.1s' }}
              >
                {/* Avatar circle — only show when vendor has a real name */}
                {vendor.name ? (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avColor(vendor.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{initials(vendor.name)}</span>
                  </div>
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px dashed var(--color-border)', flexShrink: 0 }} />
                )}

                {/* Name + sub */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#2c2825', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName}
                  </div>
                  {vendor.contact_name && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{vendor.contact_name}</div>
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
                  <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)', background: '#F5F1EC' }}>
                  {isEditing ? (
                    /* Edit form */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Name</label>
                        <input style={{ display: 'block' }} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Booked Amount</label>
                        <input type="number" style={{ display: 'block' }} value={editForm.booked_amount ?? ''} onChange={e => setEditForm(f => ({ ...f, booked_amount: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Contact Name</label>
                        <input style={{ display: 'block' }} value={editForm.contact_name ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Email</label>
                        <input style={{ display: 'block' }} value={editForm.contact_email ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Phone</label>
                        <input style={{ display: 'block' }} value={editForm.contact_phone ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Website</label>
                        <input style={{ display: 'block' }} value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Notes</label>
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
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Email</div>
                              <div style={{ fontSize: '13px', color: '#2c2825' }}>{vendor.contact_email}</div>
                            </div>
                          )}
                          {vendor.contact_phone && (
                            <div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Phone</div>
                              <div style={{ fontSize: '13px', color: '#2c2825' }}>{vendor.contact_phone}</div>
                            </div>
                          )}
                          {vendor.website && (
                            <div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Website</div>
                              <a href={vendor.website} target="_blank" rel="noopener" style={{ fontSize: '13px', color: 'var(--color-accent)' }}>{vendor.website}</a>
                            </div>
                          )}
                          {vendor.booked_amount != null && (
                            <div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Booked Amount</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-heading)' }}>${vendor.booked_amount.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {vendor.notes && (
                        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg)', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                          {vendor.notes}
                        </div>
                      )}
                    </>
                  )}

                  {/* Booked extras: payment schedule + documents + notes */}
                  {vendor.status === 'booked' && !isEditing && (
                    <>
                      {renderPaymentSchedule(vendor)}
                      {renderDocumentsSection(vendor)}
                      {renderNotesSection(vendor)}
                    </>
                  )}

                  {/* Notes for non-booked vendors too */}
                  {vendor.status !== 'booked' && !isEditing && renderNotesSection(vendor)}

                  {/* Action row */}
                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                      <select
                        value={vendor.status}
                        onChange={e => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                        style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: '#fff', color: '#2c2825', flex: '0 0 auto' }}
                      >
                        <option value="not_started">Not Started</option>
                        <option value="researching">Researching</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="meeting_scheduled">Meeting Scheduled</option>
                        <option value="booked">Booked ✓</option>
                        <option value="eliminated">Eliminated ✕</option>
                      </select>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => { setEditingId(vendor.id); setEditForm(vendor) }} style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Edit</button>
                      <button onClick={() => handleDelete(vendor.id)} style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Remove</button>
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
            <summary style={{ fontSize: '12px', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
              {eliminated.length} eliminated vendor{eliminated.length !== 1 ? 's' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {eliminated.map(vendor => (
                <div key={vendor.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#f5f0ef', border: '1px solid #e8e0dc', opacity: 0.75 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#d0c8c5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{initials(vendor.name || 'UN')}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-muted)' }}>{vendor.name || 'Unnamed vendor'}</div>
                  <button onClick={() => handleDelete(vendor.id)} style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
