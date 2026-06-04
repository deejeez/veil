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
import { getVendorNotes, addVendorNote, deleteVendorNote, toggleVendorNotePin } from '../lib/vendorNotes'
import type { VendorNoteType } from '../types/database'
import GlowBorder from '../components/GlowBorder'

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
  const [shortlist, setShortlist] = useState<{ name: string; address: string; website?: string; style?: string; price_range?: string; why_fit?: string }[]>([])
  const [shortlistLoading, setShortlistLoading] = useState(false)
  const [shortlistError, setShortlistError] = useState<string | null>(null)
  const [shortlistExpanded, setShortlistExpanded] = useState(false)
  const [contracts, setContracts] = useState<{ id: string; vendor_id: string; file_path: string; file_name: string; document_type: 'contract' | 'proposal'; ai_review: AiReview | null }[]>([])
  const [uploadingContract, setUploadingContract] = useState(false)
  const [reviewingContractId, setReviewingContractId] = useState<string | null>(null)
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, VendorNote[]>>({})
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [noteType, setNoteType] = useState<Record<string, VendorNoteType>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const contractInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [noteModal, setNoteModal] = useState<{ vendorId: string; status: VendorStatus; note: string } | null>(null)
  const [vendorPayments, setVendorPayments] = useState<Record<string, Payment[]>>({})
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null)
  const [newVendorPayment, setNewVendorPayment] = useState({ label: '', amount: '', due_date: '', paid_by: 'couple' })
  const [savingVendorPayment, setSavingVendorPayment] = useState(false)
  const [categoryLabel, setCategoryLabel] = useState<string>(category ?? '')
  const [suggestedHistory, setSuggestedHistory] = useState<string[]>([])
  const [toast, setToast] = useState<{ message: string; vendorId: string } | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [comparing, setComparing] = useState(false)
  const [comparedVendorIds, setComparedVendorIds] = useState<string[]>([])
  const [swapDropdownOpen, setSwapDropdownOpen] = useState(false)

  function showToast(message: string, vendorId: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, vendorId })
    setToastVisible(true)
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setToast(null), 300)
    }, 5000)
  }

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
      const excludeNames = vendors.map(v => v.name)
      const { data, error: fnError } = await supabase.functions.invoke('vendor-shortlist', {
        body: {
          couple_id: couple.id,
          category,
          exclude_names: excludeNames,
          previously_suggested: suggestedHistory,
        },
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
      const newVendors = (data as { vendors?: typeof shortlist })?.vendors ?? []
      if (newVendors.length === 0) {
        setShortlistError('No suggestions found for your location. Make sure your city is set in your profile.')
        return
      }
      setSuggestedHistory(prev => [...prev, ...newVendors.map(v => v.name)])
      setShortlist(newVendors)
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
      const type = noteType[vendorId] ?? 'note'
      const note = await addVendorNote({ couple_id: couple.id, vendor_id: vendorId, text, type, pinned: false })
      setNotes(prev => ({ ...prev, [vendorId]: [note, ...(prev[vendorId] ?? [])] }))
      setNoteText(prev => ({ ...prev, [vendorId]: '' }))
    } catch {
      alert('Failed to add note. Please try again.')
    } finally {
      setSavingNote(null)
    }
  }

  async function handleTogglePin(vendorId: string, noteId: string) {
    const vendorNotes = notes[vendorId] ?? []
    const note = vendorNotes.find(n => n.id === noteId)
    if (!note) return
    const newPinned = !note.pinned
    try {
      await toggleVendorNotePin(noteId, newPinned)
      setNotes(prev => ({
        ...prev,
        [vendorId]: (prev[vendorId] ?? []).map(n => n.id === noteId ? { ...n, pinned: newPinned } : n),
      }))
    } catch {
      alert('Failed to update pin. Please try again.')
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

  const booked    = vendors.filter(v => v.status === 'booked' && v.name)
  const inProgress = vendors.filter(v => ['researching', 'shortlisted', 'meeting_scheduled'].includes(v.status) && v.name)
  const notStarted = vendors.filter(v => v.status === 'not_started' && v.name)
  const eliminated = vendors.filter(v => v.status === 'eliminated' && v.name)
  const visible   = vendors.filter(v => v.status !== 'eliminated' && v.name)

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]" style={{ marginBottom: '10px' }}>
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
              {uploadingContract ? 'Uploading...' : 'Upload Contract'}
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

  // ─── Communication Log sub-render ───────────────────────────────────────────

  const NOTE_TYPE_CONFIG: Record<VendorNoteType, { label: string; border: string; bg: string; color: string; placeholder: string; icon: React.ReactNode }> = {
    note: {
      label: 'Note', border: 'var(--color-border)', bg: '#F5F1EC', color: 'var(--color-text-muted)',
      placeholder: 'Add a note...',
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    },
    call: {
      label: 'Call', border: '#8FA3B8', bg: '#E2EAF0', color: '#5A7A8F',
      placeholder: 'What was discussed?',
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    },
    quote: {
      label: 'Quote', border: '#7B8F6B', bg: '#E8F0E4', color: '#5A7A4A',
      placeholder: 'Quote details and amount...',
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
  }

  function renderNotesSection(vendor: Vendor) {
    const vendorNotes = notes[vendor.id] ?? []
    const text = noteText[vendor.id] ?? ''
    const currentType = noteType[vendor.id] ?? 'note'
    const isSaving = savingNote === vendor.id
    const cfg = NOTE_TYPE_CONFIG[currentType]

    // Sort: pinned first, then by date descending
    const sorted = [...vendorNotes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Group by month (only for 5+ entries)
    const useGrouping = sorted.length >= 5
    const groups: { label: string; notes: VendorNote[] }[] = []
    if (useGrouping) {
      const pinned = sorted.filter(n => n.pinned)
      const unpinned = sorted.filter(n => !n.pinned)
      if (pinned.length > 0) {
        groups.push({ label: 'PINNED', notes: pinned })
      }
      const monthMap = new Map<string, VendorNote[]>()
      unpinned.forEach(n => {
        const d = new Date(n.created_at)
        const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
        if (!monthMap.has(key)) monthMap.set(key, [])
        monthMap.get(key)!.push(n)
      })
      monthMap.forEach((notes, label) => groups.push({ label, notes }))
    }

    function renderNoteCard(note: VendorNote) {
      const nCfg = NOTE_TYPE_CONFIG[note.type ?? 'note'] ?? NOTE_TYPE_CONFIG.note
      return (
        <div key={note.id} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${nCfg.border}`, position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: nCfg.bg, color: nCfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {nCfg.label}
              </span>
              {note.pinned && (
                <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(184,146,106,0.10)', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pinned
                </span>
              )}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#2c2825', margin: '0 0 4px 0', lineHeight: 1.5, wordBreak: 'break-word' }}>{note.text}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
              {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignSelf: 'flex-start' }}>
            <button
              onClick={() => handleTogglePin(vendor.id, note.id)}
              title={note.pinned ? 'Unpin' : 'Pin'}
              style={{ fontSize: '13px', color: note.pinned ? 'var(--color-accent)' : 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5"/><path d="M9 2h6l-1 7h4l-8 8V9H6l3-7z"/>
              </svg>
            </button>
            <button
              onClick={() => handleDeleteNote(vendor.id, note.id)}
              style={{ fontSize: '14px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
            >×</button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
            Communication Log
          </div>
          {vendorNotes.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {vendorNotes.length} {vendorNotes.length === 1 ? 'entry' : 'entries'}
            </div>
          )}
        </div>

        {/* Type selector pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {(Object.keys(NOTE_TYPE_CONFIG) as VendorNoteType[]).map(type => {
            const tc = NOTE_TYPE_CONFIG[type]
            const active = currentType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setNoteType(prev => ({ ...prev, [vendor.id]: type }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
                  background: active ? 'rgba(184,146,106,0.10)' : '#F5F1EC',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: active ? '1px solid rgba(184,146,106,0.25)' : '1px solid transparent',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{tc.icon}</span>
                {tc.label}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => handleAddNote(vendor.id)}
            disabled={isSaving || !text.trim()}
            style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '7px', background: isSaving || !text.trim() ? '#D4CFC8' : 'var(--color-accent)', color: '#fff', border: 'none', cursor: isSaving || !text.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}
          >
            {isSaving ? 'Adding...' : 'Add'}
          </button>
        </div>

        {/* Input */}
        <textarea
          rows={3}
          placeholder={cfg.placeholder}
          value={text}
          onChange={e => setNoteText(prev => ({ ...prev, [vendor.id]: e.target.value }))}
          style={{ display: 'block', width: '100%', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', marginBottom: vendorNotes.length > 0 ? '12px' : '4px' }}
        />

        {/* Empty hint */}
        {vendorNotes.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            Track calls, emails, meetings, and quotes with this vendor
          </div>
        )}

        {/* Note entries */}
        {vendorNotes.length > 0 && !useGrouping && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sorted.map(note => renderNoteCard(note))}
          </div>
        )}

        {/* Grouped entries */}
        {useGrouping && groups.map(group => (
          <div key={group.label} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                {group.label}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.notes.map(note => renderNoteCard(note))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <style>{`
        @keyframes shimmerSweep {
          0% { left: -75%; }
          100% { left: 125%; }
        }
        @keyframes aiLabelShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .ai-shortlist-btn {
          position: relative;
          overflow: hidden;
        }
        .ai-shortlist-btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -75%;
          width: 50%;
          height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transform: skewX(-20deg);
          pointer-events: none;
        }
        .ai-shortlist-btn:not(:disabled):hover::after {
          animation: shimmerSweep 0.6s ease-out;
        }
        .ai-label-shimmer {
          background: linear-gradient(90deg, #B8926A, #C4785C, #D4A574, #B8926A);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: aiLabelShimmer 4s ease infinite;
        }
      `}</style>
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
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {visible.length >= 2 && !comparing && (
            <button
              onClick={() => {
                const maxCols = window.innerWidth >= 1400 ? 4 : 3
                setComparedVendorIds(visible.slice(0, maxCols).map(v => v.id))
                setComparing(true)
              }}
              style={{ fontSize: '13px', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-border)', borderRadius: '8px', padding: '6px 16px', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}
            >
              Compare
            </button>
          )}
          <button
            onClick={handleAddVendor}
            style={{ fontSize: '13px', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', borderRadius: '8px', padding: '6px 16px', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            + Add Vendor
          </button>
        </div>
      </div>

      {/* ══════ COMPARISON VIEW ══════ */}
      {comparing && (() => {
        const compared = comparedVendorIds.map(id => vendors.find(v => v.id === id)).filter(Boolean) as Vendor[]
        if (compared.length < 2) { setComparing(false); return null }
        const maxCols = typeof window !== 'undefined' && window.innerWidth >= 1400 ? 4 : 3
        const canSwap = visible.length > maxCols

        function handleBookFromCompare(vendorId: string) {
          setNoteModal({ vendorId, status: 'booked' as VendorStatus, note: '' })
        }

        const CompareRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: '100px', flexShrink: 0, padding: '10px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#FAFAF8', display: 'flex', alignItems: 'flex-start' }}>
              {label}
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
              {children}
            </div>
          </div>
        )

        const Cell = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
          <div style={{ padding: '10px 12px', borderLeft: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-primary)', ...style }}>
            {children}
          </div>
        )

        const Em = () => <span style={{ color: 'var(--color-text-muted)' }}>—</span>

        // Mobile stacked layout
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

        return (
          <div>
            {/* Back + controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => setComparing(false)}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}
              >
                ← Back to list
              </button>
              {canSwap && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setSwapDropdownOpen(!swapDropdownOpen)}
                    style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    Change vendors ▾
                  </button>
                  {swapDropdownOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '180px', padding: '4px' }}>
                      {visible.map(v => {
                        const included = comparedVendorIds.includes(v.id)
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              if (included) {
                                if (comparedVendorIds.length <= 2) return
                                setComparedVendorIds(prev => prev.filter(id => id !== v.id))
                              } else {
                                if (comparedVendorIds.length >= maxCols) {
                                  setComparedVendorIds(prev => [...prev.slice(1), v.id])
                                } else {
                                  setComparedVendorIds(prev => [...prev, v.id])
                                }
                              }
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                              padding: '8px 10px', border: 'none', borderRadius: '6px',
                              background: included ? 'rgba(184,146,106,0.08)' : 'transparent',
                              cursor: included && comparedVendorIds.length <= 2 ? 'default' : 'pointer',
                              fontSize: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ width: '14px', fontSize: '11px', color: included ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                              {included ? '✓' : ''}
                            </span>
                            {v.name || 'Unnamed'}
                          </button>
                        )
                      })}
                      <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                      <button
                        onClick={() => setSwapDropdownOpen(false)}
                        style={{ width: '100%', padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', fontFamily: 'var(--font-body)' }}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comparing label pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>Comparing:</span>
              {compared.map(v => (
                <span key={v.id} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(184,146,106,0.10)', color: 'var(--color-accent)', fontWeight: 600 }}>
                  {v.name || 'Unnamed'}
                </span>
              ))}
            </div>

            {/* ── Mobile: stacked layout ── */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {compared.map(vendor => {
                  const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.not_started
                  const vNotes = notes[vendor.id] ?? []
                  const vPayments = vendorPayments[vendor.id] ?? []
                  const vDocs = contracts.filter(c => c.vendor_id === vendor.id)
                  const paidTotal = vPayments.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
                  const dueTotal = vPayments.filter(p => !p.paid_date).reduce((s, p) => s + p.amount, 0)

                  return (
                    <div key={vendor.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                      {/* Sticky name header */}
                      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid var(--color-border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avColor(vendor.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{initials(vendor.name || 'UN')}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#2c2825' }}>{vendor.name || 'Unnamed'}</div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Price */}
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Booked Amount</div>
                          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#2c2825' }}>
                            {vendor.booked_amount != null ? `$${vendor.booked_amount.toLocaleString()}` : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                          </div>
                        </div>
                        {/* Contact */}
                        {(vendor.contact_name || vendor.contact_email || vendor.contact_phone) && (
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Contact</div>
                            {vendor.contact_name && <div style={{ fontSize: '12px', color: '#2c2825' }}>{vendor.contact_name}</div>}
                            {vendor.contact_email && <div style={{ fontSize: '12px', color: '#2c2825' }}>{vendor.contact_email}</div>}
                            {vendor.contact_phone && <div style={{ fontSize: '12px', color: '#2c2825' }}>{vendor.contact_phone}</div>}
                          </div>
                        )}
                        {/* Website */}
                        {vendor.website && (
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Website</div>
                            <a href={vendor.website} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--color-accent)' }}>{vendor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                          </div>
                        )}
                        {/* Notes count */}
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{vNotes.length > 0 ? `${vNotes.length} note${vNotes.length !== 1 ? 's' : ''}` : 'No notes yet'}</div>
                        {/* Payments */}
                        {vendor.status === 'booked' && (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {vPayments.length > 0 ? `$${paidTotal.toLocaleString()} paid / $${dueTotal.toLocaleString()} due` : 'No payments'}
                          </div>
                        )}
                        {/* Documents */}
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {vDocs.length > 0 ? `${vDocs.length} document${vDocs.length !== 1 ? 's' : ''}` : 'No documents'}
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                          {vendor.status !== 'booked' ? (
                            <button
                              onClick={() => handleBookFromCompare(vendor.id)}
                              style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >
                              Book This One
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '6px', background: '#E8F0E4', color: '#5A7A4A', fontWeight: 600 }}>Booked</span>
                          )}
                          <button
                            onClick={() => { setComparing(false); setExpandedId(vendor.id) }}
                            style={{ fontSize: '12px', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── Desktop: row-based comparison table ── */
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                {/* Vendor header row */}
                <CompareRow label="">
                  {compared.map(vendor => {
                    const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.not_started
                    return (
                      <Cell key={vendor.id} style={{ padding: '14px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avColor(vendor.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{initials(vendor.name || 'UN')}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#2c2825' }}>{vendor.name || 'Unnamed'}</div>
                            {vendor.contact_name && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{vendor.contact_name}</div>}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>
                      </Cell>
                    )
                  })}
                </CompareRow>

                {/* Price row */}
                <CompareRow label="Price">
                  {compared.map(vendor => (
                    <Cell key={vendor.id}>
                      {vendor.booked_amount != null ? (
                        <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#2c2825' }}>
                          ${vendor.booked_amount.toLocaleString()}
                        </span>
                      ) : <Em />}
                    </Cell>
                  ))}
                </CompareRow>

                {/* Contact row */}
                <CompareRow label="Contact">
                  {compared.map(vendor => (
                    <Cell key={vendor.id}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {vendor.contact_email ? <div style={{ fontSize: '12px' }}>{vendor.contact_email}</div> : <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>}
                        {vendor.contact_phone ? <div style={{ fontSize: '12px' }}>{vendor.contact_phone}</div> : <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</div>}
                      </div>
                    </Cell>
                  ))}
                </CompareRow>

                {/* Website row */}
                <CompareRow label="Website">
                  {compared.map(vendor => (
                    <Cell key={vendor.id}>
                      {vendor.website ? (
                        <a href={vendor.website} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--color-accent)', wordBreak: 'break-all' }}>
                          {vendor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : <Em />}
                    </Cell>
                  ))}
                </CompareRow>

                {/* Notes row */}
                <CompareRow label="Notes">
                  {compared.map(vendor => {
                    const vendorNotesText = vendor.notes
                    return (
                      <Cell key={vendor.id}>
                        {vendorNotesText ? (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {vendorNotesText}
                          </div>
                        ) : <Em />}
                      </Cell>
                    )
                  })}
                </CompareRow>

                {/* Communication Log count row */}
                <CompareRow label="Log">
                  {compared.map(vendor => {
                    const vNotes = notes[vendor.id] ?? []
                    return (
                      <Cell key={vendor.id}>
                        <button
                          onClick={() => { setComparing(false); setExpandedId(vendor.id) }}
                          style={{ fontSize: '12px', color: vNotes.length > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}
                        >
                          {vNotes.length > 0 ? `${vNotes.length} note${vNotes.length !== 1 ? 's' : ''}` : 'No notes'}
                        </button>
                      </Cell>
                    )
                  })}
                </CompareRow>

                {/* Payments row (only shows if any compared vendor is booked) */}
                {compared.some(v => v.status === 'booked') && (
                  <CompareRow label="Payments">
                    {compared.map(vendor => {
                      if (vendor.status !== 'booked') return <Cell key={vendor.id}><Em /></Cell>
                      const vPayments = vendorPayments[vendor.id] ?? []
                      const paidTotal = vPayments.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
                      const dueTotal = vPayments.filter(p => !p.paid_date).reduce((s, p) => s + p.amount, 0)
                      return (
                        <Cell key={vendor.id}>
                          {vPayments.length > 0 ? (
                            <div style={{ fontSize: '12px' }}>
                              <span style={{ color: '#7B8F6B', fontWeight: 600 }}>${paidTotal.toLocaleString()}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}> paid</span>
                              <br />
                              <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>${dueTotal.toLocaleString()}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}> due</span>
                            </div>
                          ) : <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No payments</span>}
                        </Cell>
                      )
                    })}
                  </CompareRow>
                )}

                {/* Documents row */}
                <CompareRow label="Documents">
                  {compared.map(vendor => {
                    const vDocs = contracts.filter(c => c.vendor_id === vendor.id)
                    return (
                      <Cell key={vendor.id}>
                        <span style={{ fontSize: '12px', color: vDocs.length > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                          {vDocs.length > 0 ? `${vDocs.length} document${vDocs.length !== 1 ? 's' : ''}` : 'No documents'}
                        </span>
                      </Cell>
                    )
                  })}
                </CompareRow>

                {/* Action row */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ width: '100px', flexShrink: 0, background: '#FAFAF8' }} />
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
                    {compared.map(vendor => (
                      <div key={vendor.id} style={{ padding: '12px', borderLeft: '1px solid var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {vendor.status !== 'booked' ? (
                          <button
                            onClick={() => handleBookFromCompare(vendor.id)}
                            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                          >
                            Book This One
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '6px', background: '#E8F0E4', color: '#5A7A4A', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Booked</span>
                        )}
                        <button
                          onClick={() => { setComparing(false); setExpandedId(vendor.id) }}
                          style={{ fontSize: '12px', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-border)', borderRadius: '8px', padding: '6px 14px', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                        >
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ══════ NORMAL LIST VIEW ══════ */}
      {!comparing && <>
      {/* AI Shortlist CTA */}
      <GlowBorder style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative', zIndex: 1, borderRadius: '12px', background: '#F5F1EC', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ flex: 1 }}>
            <div className="ai-label-shimmer" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px', fontWeight: 600 }}>
              AI Advisor
            </div>
            <div style={{ fontSize: '13px', color: '#2C2825', fontWeight: 500, lineHeight: 1.4 }}>
              {shortlistLoading
                ? `Searching for ${categoryLabel.toLowerCase()} ${couple?.city ? `in ${couple.city}` : 'for your wedding'}...`
                : shortlist.length > 0
                  ? `${shortlist.length} ${categoryLabel.toLowerCase()} recommendations for your ${couple?.city ? `${couple.city} ` : ''}wedding`
                  : `Find ${categoryLabel.toLowerCase()} ${couple?.city ? `in ${couple.city} ` : ''}that fit your style and budget`}
            </div>
            {!shortlistLoading && shortlist.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Based on your vibe, budget, and wedding date. Takes about 10 seconds.
              </div>
            )}
            {shortlistError && <div style={{ fontSize: '12px', color: '#C4785C', marginTop: '4px' }}>{shortlistError}</div>}
          </div>
          <button
            className="ai-shortlist-btn"
            onClick={handleGetShortlist}
            disabled={shortlistLoading}
            style={{ fontSize: '12px', fontWeight: 600, padding: '7px 16px', borderRadius: '8px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: shortlistLoading ? 'default' : 'pointer', flexShrink: 0, opacity: shortlistLoading ? 0.7 : 1 }}
          >
            {shortlistLoading ? 'Finding...' : shortlist.length > 0 ? 'Refresh' : 'Get Recommendations'}
          </button>
        </div>
      </GlowBorder>

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
              {shortlist.map((v, i) => {
                const isAdded = vendors.some(vd => vd.name === v.name)
                return (
                <div key={i} style={{ padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '8px', background: isAdded ? 'rgba(123, 143, 107, 0.06)' : 'var(--color-bg)', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'background 300ms' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2825', marginBottom: '1px' }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>{v.address}</div>
                    {v.style && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Style:</span> {v.style}
                      </div>
                    )}
                    {v.price_range && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Est. range:</span> {v.price_range}
                      </div>
                    )}
                    {v.why_fit && (
                      <div style={{ fontSize: '11px', color: '#7a6358', fontStyle: 'italic', marginBottom: '4px' }}>{v.why_fit}</div>
                    )}
                    {v.website && (
                      <a href={v.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--color-accent)' }}>
                        {v.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    )}
                  </div>
                  <button
                    disabled={isAdded}
                    onClick={async () => {
                      if (!couple) return
                      try {
                        const notesLines = [
                          v.style ? `Style: ${v.style}` : '',
                          v.price_range ? `Est. range: ${v.price_range}` : '',
                          v.why_fit ? `AI note: ${v.why_fit}` : '',
                        ].filter(Boolean)
                        const vendor = await upsertVendor({
                          couple_id: couple.id,
                          category: category!,
                          name: v.name,
                          website: v.website,
                          status: 'shortlisted',
                          notes: notesLines.length > 0 ? notesLines.join('\n') : null,
                        })
                        setVendors(prev => [...prev, vendor])
                        showToast(`${v.name} added to your ${categoryLabel} list`, vendor.id)
                      } catch {
                        alert('Failed to add vendor.')
                      }
                    }}
                    style={{ fontSize: '12px', color: isAdded ? '#7B8F6B' : 'var(--color-accent)', border: `1px solid ${isAdded ? '#7B8F6B' : 'var(--color-accent)'}`, borderRadius: '6px', padding: '4px 12px', background: 'none', cursor: isAdded ? 'default' : 'pointer', flexShrink: 0, transition: 'color 200ms, border-color 200ms' }}
                  >
                    {isAdded ? '✓ Added' : 'Add →'}
                  </button>
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state — add vendor */}
      {visible.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {/* Add a Vendor */}
          <div style={{ background: '#F8F5F1', border: '1px solid var(--color-border)', borderLeft: '4px solid #D4CFC8', padding: '16px 18px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>+ Add a Vendor</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[8px]" style={{ marginBottom: '10px' }}>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]" style={{ marginBottom: '12px' }}>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[16px] gap-y-[8px]" style={{ marginBottom: '12px' }}>
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

                  {/* Payment schedule (booked only) */}
                  {vendor.status === 'booked' && !isEditing && renderPaymentSchedule(vendor)}

                  {/* Documents + notes for all vendors */}
                  {!isEditing && (
                    <>
                      {renderDocumentsSection(vendor)}
                      {renderNotesSection(vendor)}
                    </>
                  )}

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
      </>}

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
      {/* Toast notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: `translateX(-50%) translateY(${toastVisible ? '0' : '16px'})`, opacity: toastVisible ? 1 : 0, transition: 'opacity 300ms, transform 300ms', background: '#2C2825', color: 'white', borderRadius: '8px', padding: '12px 24px', fontSize: '13px', fontFamily: 'var(--font-body)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', display: 'flex', gap: '14px', alignItems: 'center', zIndex: 1000, whiteSpace: 'nowrap' }}>
          <span>{toast.message}</span>
          <button
            onClick={async () => {
              if (!toast) return
              try {
                await deleteVendor(toast.vendorId)
                setVendors(prev => prev.filter(v => v.id !== toast.vendorId))
              } catch {
                // undo failed silently
              }
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
              setToastVisible(false)
              setTimeout(() => setToast(null), 300)
            }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}
          >
            Undo
          </button>
        </div>
      )}
    </AppShell>
  )
}
