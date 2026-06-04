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
import type { VendorNoteType, VendorLineItem } from '../types/database'
import { getLineItemsForVendors, insertLineItems, deleteLineItemsForVendor, updateLineItem, deleteLineItem } from '../lib/vendorLineItems'
import GlowBorder from '../components/GlowBorder'
import confetti from 'canvas-confetti'

// ─── Design helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:            { bg: '#5A7A4A', color: '#fff', label: 'Booked' },
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
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null) // 'vendorId-contract' or 'vendorId-proposal'
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [reviewingContractId, setReviewingContractId] = useState<string | null>(null)
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null)
  const [docViewer, setDocViewer] = useState<{ url: string; name: string; type: 'pdf' | 'image' } | null>(null)
  const [notes, setNotes] = useState<Record<string, VendorNote[]>>({})
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [noteType, setNoteType] = useState<Record<string, VendorNoteType>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const contractInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [noteModal, setNoteModal] = useState<{ vendorId: string; status: VendorStatus; note: string } | null>(null)
  const [bookingModal, setBookingModal] = useState<{ vendorId: string; vendorName: string } | null>(null)
  const [bookingForm, setBookingForm] = useState({ totalCost: '', depositAmount: '', depositDate: new Date().toISOString().split('T')[0], paidBy: 'couple', paymentMethod: '' })
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [unbookModal, setUnbookModal] = useState<{ vendorId: string; vendorName: string; newStatus: VendorStatus } | null>(null)
  const [eliminatePrompt, setEliminatePrompt] = useState<{ vendorId: string; vendorName: string } | null>(null)
  const [lineItemsExpanded, setLineItemsExpanded] = useState<Record<string, boolean>>({})
  const [reviewError, setReviewError] = useState<string | null>(null)
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
  const [comparePicking, setComparePicking] = useState(false)
  const [comparedVendorIds, setComparedVendorIds] = useState<string[]>([])
  const [comparePickerMsg, setComparePickerMsg] = useState<string | null>(null)

  // ─── Line item extraction state ──────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<Record<string, VendorLineItem[]>>({})
  const [extracting, setExtracting] = useState<string | null>(null) // vendorId
  type ExtractionResult = {
    vendorId: string
    fileName: string
    vendor_fields: Record<string, unknown>
    line_items: Array<{ label: string; normalized_label: string; amount: number | null; quantity: number | null; unit: string | null; notes: string | null }>
  }
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({})
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [applyingExtraction, setApplyingExtraction] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<string | null>(null)
  const [editLineItemForm, setEditLineItemForm] = useState<Partial<VendorLineItem>>({})
  const [addingLineItem, setAddingLineItem] = useState<string | null>(null) // vendorId
  const [newLineItem, setNewLineItem] = useState({ label: '', normalized_label: '', amount: '', quantity: '', unit: '' })

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
      // Load line items for all vendors in this category
      const vendorIds = allVendors.map(v => v.id)
      if (vendorIds.length > 0) {
        const allItems = await getLineItemsForVendors(vendorIds)
        const itemMap: Record<string, VendorLineItem[]> = {}
        allVendors.forEach(v => { itemMap[v.id] = allItems.filter(i => i.vendor_id === v.id) })
        setLineItems(itemMap)
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
    if (status === 'booked') {
      const vendor = vendors.find(v => v.id === vendorId)
      setBookingForm({ totalCost: vendor?.booked_amount ? String(vendor.booked_amount) : '', depositAmount: '', depositDate: new Date().toISOString().split('T')[0], paidBy: 'couple', paymentMethod: '' })
      setBookingError(null)
      setBookingModal({ vendorId, vendorName: vendor?.name || 'this vendor' })
      return
    }
    if (status === 'eliminated') {
      setNoteModal({ vendorId, status, note: '' })
      return
    }
    // Un-booking: confirm before changing away from booked
    const vendor = vendors.find(v => v.id === vendorId)
    if (vendor?.status === 'booked') {
      setUnbookModal({ vendorId, vendorName: vendor.name || 'this vendor', newStatus: status })
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
          const label = '✕ Eliminated: '
          await sb.from('vendors').update({ notes: existingNote + label + note }).eq('id', vendorId)
        }
      }
      setVendors(prev => prev.map(v => v.id === vendorId ? {
        ...v,
        status,
        notes: note.trim()
          ? ((v.notes ? v.notes + '\n\n' : '') + '✕ Eliminated: ' + note)
          : v.notes
      } : v))
      setNoteModal(null)
    } catch {
      alert('Failed to update status. Please try again.')
    }
  }

  async function handleBookingConfirm(skipDeposit: boolean) {
    if (!bookingModal || !couple) return
    const { vendorId, vendorName } = bookingModal
    const totalCost = Number(bookingForm.totalCost)
    if (!totalCost || totalCost <= 0) {
      setBookingError('Please enter a total contract amount.')
      return
    }
    const depositAmount = skipDeposit ? 0 : Number(bookingForm.depositAmount) || 0
    if (depositAmount > totalCost) {
      setBookingError("Deposit can't exceed the total cost.")
      return
    }
    setBookingSaving(true)
    setBookingError(null)
    try {
      // 1. Set vendor status to booked and update booked_amount
      await updateVendorStatus(vendorId, 'booked')
      await supabase.from('vendors').update({ booked_amount: totalCost }).eq('id', vendorId)

      // 2. Create deposit payment record if applicable
      if (depositAmount > 0) {
        await insertPayment({
          couple_id: couple.id,
          vendor_id: vendorId,
          label: 'Deposit',
          amount: depositAmount,
          due_date: bookingForm.depositDate || null,
          paid_date: bookingForm.depositDate || new Date().toISOString().split('T')[0],
          paid_by: bookingForm.paidBy,
          notes: null,
          status: 'paid',
          payment_method: bookingForm.paymentMethod || null,
        })
      }

      // 3. Update local state
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: 'booked' as VendorStatus, booked_amount: totalCost } : v))
      setBookingModal(null)

      // 4. Confetti celebration
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.3 }, colors: ['#C9A96E', '#8B9E7E', '#FAF7F2', '#FFFFFF'] })

      // 5. Reload to pick up new payment data
      await load()

      // 6. Show success toast
      showToast(`Booked! ${vendorName} is locked in.`, vendorId)

      // 7. After a beat, show elimination prompt if there are other active vendors
      const othersActive = vendors.filter(v => v.id !== vendorId && v.status !== 'eliminated' && v.status !== 'booked' && v.name)
      if (othersActive.length > 0) {
        setTimeout(() => setEliminatePrompt({ vendorId, vendorName }), 1500)
      }
    } catch {
      setBookingError('Failed to complete booking. Please try again.')
    } finally {
      setBookingSaving(false)
    }
  }

  async function handleUnbookConfirm() {
    if (!unbookModal) return
    const { vendorId, newStatus } = unbookModal
    try {
      await updateVendorStatus(vendorId, newStatus)
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: newStatus } : v))
      setUnbookModal(null)
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

  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  function getFileExt(name: string) {
    return name.split('.').pop()?.toLowerCase() ?? ''
  }

  function isImageFile(name: string) {
    const ext = getFileExt(name)
    return ['png', 'jpg', 'jpeg'].includes(ext)
  }

  async function handleDocumentUpload(vendorId: string, file: File, documentType: 'contract' | 'proposal') {
    if (!couple) return
    setUploadError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Please upload a PDF, PNG, or JPG file')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File must be under 10MB')
      return
    }

    const uploadKey = `${vendorId}-${documentType}`
    setUploadingDoc(uploadKey)
    try {
      const vendor = vendors.find(v => v.id === vendorId)
      const urlField = documentType === 'contract' ? 'contract_url' : 'proposal_url'

      // Delete old file if replacing
      const oldPath = vendor?.[urlField]
      if (oldPath) {
        await supabase.storage.from('documents').remove([oldPath])
      }

      // Upload new file
      const ext = getFileExt(file.name)
      const timestamp = Math.floor(Date.now() / 1000)
      const filePath = `${couple.id}/${vendorId}/${documentType}_${timestamp}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true })
      if (storageError) throw storageError

      // Update vendor record
      const { error: updateError } = await supabase
        .from('vendors')
        .update({ [urlField]: filePath })
        .eq('id', vendorId)
      if (updateError) throw updateError

      // Update local state
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, [urlField]: filePath } : v))

      // Also create a contracts row for AI review integration (contracts only)
      if (documentType === 'contract') {
        // Remove old contract row if it exists
        const oldContract = contracts.find(c => c.vendor_id === vendorId && c.document_type === 'contract')
        if (oldContract) {
          await supabase.from('contracts').delete().eq('id', oldContract.id)
        }

        const { data: contractRow, error: insertError } = await supabase
          .from('contracts')
          .insert({ couple_id: couple.id, vendor_id: vendorId, file_path: filePath, file_name: file.name, document_type: 'contract' })
          .select()
          .single()
        if (insertError) throw insertError
        setContracts(prev => [
          ...prev.filter(c => !(c.vendor_id === vendorId && c.document_type === 'contract')),
          { id: contractRow.id, vendor_id: vendorId, file_path: filePath, file_name: file.name, document_type: 'contract', ai_review: null },
        ])

        // Trigger AI review
        setReviewingContractId(contractRow.id)
        try {
          const { data, error: fnError } = await supabase.functions.invoke('contract-review', {
            body: { contract_id: contractRow.id },
          })
          if (!fnError && data) {
            setContracts(prev => prev.map(c => c.id === contractRow.id ? { ...c, ai_review: data } : c))
          }
        } catch { /* AI review is best-effort */ }
        setReviewingContractId(null)
      }

      track('document_uploaded', { category, documentType })
    } catch (err: unknown) {
      setUploadError('Upload failed. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setUploadingDoc(null)
    }
  }

  async function handleDeleteDocument(vendorId: string, documentType: 'contract' | 'proposal') {
    if (!confirm('Remove this file?')) return
    const vendor = vendors.find(v => v.id === vendorId)
    if (!vendor) return
    const urlField = documentType === 'contract' ? 'contract_url' : 'proposal_url'
    const filePath = vendor[urlField]
    if (!filePath) return

    try {
      await supabase.storage.from('documents').remove([filePath])
      await supabase.from('vendors').update({ [urlField]: null }).eq('id', vendorId)
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, [urlField]: null } : v))

      // Clean up contracts row too
      if (documentType === 'contract') {
        const contractRow = contracts.find(c => c.vendor_id === vendorId && c.document_type === 'contract')
        if (contractRow) {
          await supabase.from('contracts').delete().eq('id', contractRow.id)
          setContracts(prev => prev.filter(c => c.id !== contractRow.id))
        }
      }
    } catch (err: unknown) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function handleViewDocument(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600)
    if (error || !data?.signedUrl) {
      // Try the old contracts bucket as fallback
      const { data: fallback } = await supabase.storage.from('contracts').createSignedUrl(filePath, 3600)
      if (fallback?.signedUrl) {
        const type = isImageFile(fileName) ? 'image' as const : 'pdf' as const
        setDocViewer({ url: fallback.signedUrl, name: fileName, type })
        return
      }
      setUploadError('File not found. You may need to re-upload.')
      return
    }
    const type = isImageFile(fileName) ? 'image' as const : 'pdf' as const
    setDocViewer({ url: data.signedUrl, name: fileName, type })
  }

  async function handleDownloadDocument(filePath: string, fileName: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600)
    if (!data?.signedUrl) {
      // Fallback to old bucket
      const { data: fallback } = await supabase.storage.from('contracts').createSignedUrl(filePath, 3600)
      if (fallback?.signedUrl) {
        const a = document.createElement('a')
        a.href = fallback.signedUrl
        a.download = fileName
        a.click()
        return
      }
      alert('Could not generate download link.')
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  // ─── Extraction handlers ──────────────────────────────────────────────────────

  async function handleExtractFromDocument(vendorId: string, filePath: string, documentType: 'contract' | 'proposal') {
    if (!couple) return
    const vendor = vendors.find(v => v.id === vendorId)
    const existingItems = lineItems[vendorId] ?? []
    if (existingItems.length > 0) {
      if (!confirm("You've already extracted details from a document. Extract again? This will replace the previous line items.")) return
    }
    setExtracting(vendorId)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-proposal', {
        body: { vendor_id: vendorId, file_path: filePath, document_type: documentType, category },
      })
      if (fnError) throw fnError
      const vendorFields = (data as { vendor_fields?: Record<string, unknown> }).vendor_fields ?? {}
      const items = (data as { line_items?: Array<{ label: string; normalized_label: string; amount: number | null; quantity: number | null; unit: string | null; notes: string | null }> }).line_items ?? []

      // Auto-check all fields and items (exclude key_terms — it's displayed separately, not as a checkbox)
      const initFields: Record<string, boolean> = {}
      for (const key of Object.keys(vendorFields)) {
        if (key === 'key_terms') continue
        if (vendorFields[key] !== null && vendorFields[key] !== undefined) {
          initFields[key] = true
        }
      }
      const initItems: Record<number, boolean> = {}
      items.forEach((_, i) => { initItems[i] = true })
      setCheckedFields(initFields)
      setCheckedItems(initItems)
      const ext = filePath.split('/').pop() ?? 'document'
      setExtractionResult({
        vendorId,
        fileName: `${vendor?.name ?? 'Vendor'} ${documentType}.${ext.split('.').pop()}`,
        vendor_fields: vendorFields,
        line_items: items,
      })
      track('document_extracted', { category, documentType, lineItemCount: items.length })
    } catch (err) {
      alert('Extraction failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExtracting(null)
    }
  }

  async function handleApplyExtraction() {
    if (!extractionResult || !couple) return
    setApplyingExtraction(true)
    try {
      const { vendorId, vendor_fields, line_items } = extractionResult
      const vendor = vendors.find(v => v.id === vendorId)
      if (!vendor) return

      // Apply checked vendor fields
      const updates: Partial<Vendor> = {}
      const fieldMap: Record<string, keyof Vendor> = {
        vendor_name: 'name',
        contact_name: 'contact_name',
        contact_email: 'contact_email',
        contact_phone: 'contact_phone',
        total_amount: 'booked_amount',
      }
      for (const [aiKey, vendorKey] of Object.entries(fieldMap)) {
        if (checkedFields[aiKey] && vendor_fields[aiKey] != null) {
          (updates as Record<string, unknown>)[vendorKey] = vendor_fields[aiKey]
        }
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('vendors').update(updates).eq('id', vendorId)
      }

      // Delete old line items and insert checked new ones
      await deleteLineItemsForVendor(vendorId)
      const selectedLineItems = line_items.filter((_, i) => checkedItems[i])
      if (selectedLineItems.length > 0) {
        await insertLineItems(selectedLineItems.map(item => ({
          couple_id: couple.id,
          vendor_id: vendorId,
          label: item.label,
          normalized_label: item.normalized_label,
          amount: item.amount,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
          source: 'extracted' as const,
        })))
      }

      setExtractionResult(null)
      showToast('Details applied. You can edit them anytime.', vendorId)
      await load()
    } catch (err) {
      alert('Failed to apply: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setApplyingExtraction(false)
    }
  }

  async function handleUpdateLineItem(id: string, vendorId: string) {
    try {
      await updateLineItem(id, editLineItemForm)
      setLineItems(prev => ({
        ...prev,
        [vendorId]: (prev[vendorId] ?? []).map(i => i.id === id ? { ...i, ...editLineItemForm } : i),
      }))
      setEditingLineItem(null)
      setEditLineItemForm({})
    } catch {
      alert('Failed to update.')
    }
  }

  async function handleDeleteLineItem(id: string, vendorId: string) {
    try {
      await deleteLineItem(id)
      setLineItems(prev => ({
        ...prev,
        [vendorId]: (prev[vendorId] ?? []).filter(i => i.id !== id),
      }))
    } catch {
      alert('Failed to delete.')
    }
  }

  async function handleAddManualLineItem(vendorId: string) {
    if (!couple || !newLineItem.label.trim()) return
    try {
      const items = await insertLineItems([{
        couple_id: couple.id,
        vendor_id: vendorId,
        label: newLineItem.label,
        normalized_label: newLineItem.normalized_label || newLineItem.label,
        amount: newLineItem.amount ? Number(newLineItem.amount) : null,
        quantity: newLineItem.quantity ? Number(newLineItem.quantity) : null,
        unit: newLineItem.unit || null,
        notes: null,
        source: 'manual',
      }])
      setLineItems(prev => ({
        ...prev,
        [vendorId]: [...(prev[vendorId] ?? []), ...items],
      }))
      setAddingLineItem(null)
      setNewLineItem({ label: '', normalized_label: '', amount: '', quantity: '', unit: '' })
    } catch {
      alert('Failed to add.')
    }
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
        status: 'upcoming',
        payment_method: null,
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
  const visible   = vendors
    .filter(v => v.name || v.id === editingId)
    .sort((a, b) => {
      const order: Record<string, number> = { booked: 0, meeting_scheduled: 1, shortlisted: 1, researching: 1, not_started: 2, eliminated: 3 }
      return (order[a.status] ?? 2) - (order[b.status] ?? 2)
    })
  const hasBooked = vendors.some(v => v.status === 'booked')

  const familyAName = couple?.family_a_name || 'Family A'
  const familyBName = couple?.family_b_name || 'Family B'

  function paidByLabel(key: string) {
    if (key === 'family_a') return familyAName
    if (key === 'family_b') return familyBName
    return 'Couple'
  }

  // ─── Payment progress sub-render (booked only) ──────────────────────────────

  function renderPaymentProgress(vendor: Vendor) {
    if (vendor.status !== 'booked') return null
    const payments = vendorPayments[vendor.id] ?? []
    const contractAmount = vendor.booked_amount ?? 0
    const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
    const remaining = Math.max(0, contractAmount - paidAmount)
    const pct = contractAmount > 0 ? Math.min(100, Math.round((paidAmount / contractAmount) * 100)) : 100

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px', fontWeight: 700 }}>
          Payment Progress
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
          {[
            { label: 'Contract', value: contractAmount, color: '#2c2825' },
            { label: 'Paid', value: paidAmount, color: '#5A7A4A' },
            { label: 'Remaining', value: remaining, color: '#7A7168' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', color: s.color }}>${s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ height: '4px', borderRadius: '2px', background: '#E8E2D8', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '2px', background: '#7B8F6B', width: `${pct}%`, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          ${paidAmount.toLocaleString()} of ${contractAmount.toLocaleString()} paid
        </div>
      </div>
    )
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
    const contractDoc = contracts.find(c => c.vendor_id === vendor.id && c.document_type === 'contract')
    const isUploadingContract = uploadingDoc === `${vendor.id}-contract`
    const isUploadingProposal = uploadingDoc === `${vendor.id}-proposal`

    function renderAiReview() {
      if (!contractDoc?.ai_review || contractDoc.ai_review.status !== 'complete') return null
      const flags = contractDoc.ai_review.flags
      const hasFlag = flags.some(f => f.severity === 'flag')
      const hasCaution = flags.some(f => f.severity === 'caution')
      const ratingLabel = hasFlag ? 'Review carefully' : hasCaution ? 'Some concerns' : 'Standard terms'
      const ratingColor = hasFlag ? '#C4785C' : hasCaution ? '#B8926A' : '#5A7A4A'
      const ratingBg = hasFlag ? 'rgba(196,120,92,0.08)' : hasCaution ? 'rgba(184,146,106,0.08)' : 'rgba(90,122,74,0.08)'
      const severityIcon: Record<string, React.ReactNode> = {
        info: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5A7A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
        caution: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8926A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
        flag: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4785C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
      }
      return (
        <div style={{ padding: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', marginTop: '8px' }}>
          {/* Overall rating */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '6px', background: ratingBg, marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: ratingColor }}>{ratingLabel}</span>
          </div>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontStyle: 'italic', color: '#2c2825', marginBottom: '12px', lineHeight: 1.5 }}>
            {contractDoc.ai_review.summary}
          </p>
          {flags.map((flag: AiReviewFlag, i: number) => {
            const key = `${contractDoc.id}-${i}`
            const severityColor: Record<string, string> = { flag: '#C4785C', caution: '#B8926A', info: 'var(--color-text-muted)' }
            return (
              <div key={i} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => setExpandedFlag(expandedFlag === key ? null : key)}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  {severityIcon[flag.severity] ?? null}
                  <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: severityColor[flag.severity], fontWeight: 700 }}>{flag.severity}</span>
                  <span style={{ fontSize: '13px', color: '#2c2825' }}>{flag.clause}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{expandedFlag === key ? '▲' : '▼'}</span>
                </button>
                {expandedFlag === key && (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '6px 0 0 18px', lineHeight: 1.5 }}>{flag.text}</p>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    async function handleReviewContract() {
      if (!contractDoc) return
      setReviewingContractId(contractDoc.id)
      setReviewError(null)
      try {
        const { data, error: fnError } = await supabase.functions.invoke('contract-review', { body: { contract_id: contractDoc.id } })
        if (fnError) throw fnError
        if (data?.error) throw new Error(data.error)
        if (data) setContracts(prev => prev.map(c => c.id === contractDoc.id ? { ...c, ai_review: data } : c))
      } catch {
        setReviewError('Contract review failed. Please try again.')
      }
      setReviewingContractId(null)
    }

    function renderDocRow(filePath: string, documentType: 'contract' | 'proposal') {
      const parts = filePath.split('/')
      const rawName = parts[parts.length - 1]
      const ext = getFileExt(rawName)
      const displayName = `${documentType === 'contract' ? 'Contract' : 'Proposal'}.${ext}`
      const isImg = isImageFile(rawName)
      const isReviewing = documentType === 'contract' && contractDoc && reviewingContractId === contractDoc.id
      const isExtracting = extracting === vendor.id
      const aiAction = documentType === 'contract' ? handleReviewContract : () => {
        const fp = vendor.proposal_url || vendor.contract_url
        const dt = vendor.proposal_url ? 'proposal' : 'contract'
        if (fp) handleExtractFromDocument(vendor.id, fp, dt as 'contract' | 'proposal')
      }
      const aiTooltip = documentType === 'contract' ? (contractDoc?.ai_review?.status === 'complete' ? 'Re-review with AI' : 'Review with AI') : 'Extract Details'
      const aiLoading = documentType === 'contract' ? isReviewing : isExtracting

      return (
        <div key={documentType} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)' }}>
          <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '6px', background: isImg ? '#E2EAF0' : '#F5E8DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isImg ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A7A8F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B6F4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2825', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
              {ext.toUpperCase()}
              {documentType === 'contract' && contractDoc?.ai_review?.status === 'complete' && (
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', background: '#EFF4EC', color: '#5A7A4A', fontWeight: 600 }}>AI Reviewed</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => handleViewDocument(filePath, displayName)} title="View" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onClick={() => handleDownloadDocument(filePath, displayName)} title="Download" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button onClick={aiAction} title={aiTooltip} disabled={!!aiLoading} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'none', cursor: aiLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: aiLoading ? 'var(--color-text-muted)' : 'var(--color-accent)', opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              )}
            </button>
            <button onClick={() => handleDeleteDocument(vendor.id, documentType)} title="Delete" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px', fontWeight: 700 }}>
          Documents
        </div>

        {/* Error messages */}
        {uploadError && (
          <div style={{ fontSize: '12px', color: '#C4785C', marginBottom: '8px', padding: '6px 10px', background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.20)', borderRadius: '6px' }}>
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#C4785C', cursor: 'pointer', fontSize: '11px' }}>×</button>
          </div>
        )}
        {reviewError && (
          <div style={{ fontSize: '12px', color: '#C4785C', marginBottom: '8px', padding: '6px 10px', background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.20)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {reviewError}
            <button onClick={handleReviewContract} style={{ fontSize: '11px', color: '#C4785C', background: 'none', border: '1px solid rgba(196,120,92,0.3)', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer' }}>Retry</button>
            <button onClick={() => setReviewError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#C4785C', cursor: 'pointer', fontSize: '11px' }}>×</button>
          </div>
        )}

        {/* Document rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          {vendor.contract_url && renderDocRow(vendor.contract_url, 'contract')}
          {vendor.proposal_url && renderDocRow(vendor.proposal_url, 'proposal')}
        </div>

        {/* AI review results inline */}
        {renderAiReview()}

        {/* Upload links for missing docs */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          {!vendor.contract_url && (
            <label style={{ cursor: isUploadingContract ? 'default' : 'pointer' }}>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} disabled={!!uploadingDoc} ref={el => { contractInputRefs.current[`${vendor.id}-contract`] = el }} onChange={e => { const f = e.target.files?.[0]; if (f) { handleDocumentUpload(vendor.id, f, 'contract'); e.target.value = '' } }} />
              <span style={{ fontSize: '12px', color: 'var(--color-accent)', cursor: isUploadingContract ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                {isUploadingContract ? 'Uploading...' : '+ Upload Contract'}
              </span>
            </label>
          )}
          {!vendor.proposal_url && (
            <label style={{ cursor: isUploadingProposal ? 'default' : 'pointer' }}>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} disabled={!!uploadingDoc} ref={el => { contractInputRefs.current[`${vendor.id}-proposal`] = el }} onChange={e => { const f = e.target.files?.[0]; if (f) { handleDocumentUpload(vendor.id, f, 'proposal'); e.target.value = '' } }} />
              <span style={{ fontSize: '12px', color: 'var(--color-accent)', cursor: isUploadingProposal ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                {isUploadingProposal ? 'Uploading...' : '+ Upload Proposal'}
              </span>
            </label>
          )}
        </div>
      </div>
    )
  }

  // ─── Line Items (Proposal Breakdown) sub-render ────────────────────────────────

  function renderLineItemsSection(vendor: Vendor) {
    const items = lineItems[vendor.id] ?? []
    if (items.length === 0 && !addingLineItem) return null
    const isExpanded = lineItemsExpanded[vendor.id] ?? false
    const COLLAPSE_LIMIT = 5
    const showToggle = items.length > COLLAPSE_LIMIT
    const visibleItems = isExpanded ? items : items.slice(0, COLLAPSE_LIMIT)
    const total = items.reduce((s, i) => s + (i.amount ?? 0), 0)

    function renderItem(item: VendorLineItem) {
      const isEditing = editingLineItem === item.id
      if (isEditing) {
        return (
          <div key={item.id} style={{ padding: '8px 10px', border: '1px solid var(--color-accent)', borderRadius: '7px', background: 'rgba(184,146,106,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '6px', marginBottom: '6px' }}>
              <input value={editLineItemForm.label ?? item.label} onChange={e => setEditLineItemForm(f => ({ ...f, label: e.target.value }))} style={{ fontSize: '12px' }} />
              <input type="number" value={editLineItemForm.amount ?? item.amount ?? ''} onChange={e => setEditLineItemForm(f => ({ ...f, amount: e.target.value ? Number(e.target.value) : null }))} style={{ fontSize: '12px' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button variant="secondary" onClick={() => { setEditingLineItem(null); setEditLineItemForm({}) }}>Cancel</Button>
              <Button onClick={() => handleUpdateLineItem(item.id, vendor.id)}>Save</Button>
            </div>
          </div>
        )
      }
      return (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '7px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#2c2825' }}>{item.label}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {item.normalized_label}
              {item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
              {item.notes ? ` · ${item.notes}` : ''}
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
            {item.amount != null ? `$${item.amount.toLocaleString()}` : '—'}
          </div>
          <button onClick={() => { setEditingLineItem(item.id); setEditLineItemForm({ label: item.label, amount: item.amount }) }} style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>Edit</button>
          <button onClick={() => handleDeleteLineItem(item.id, vendor.id)} style={{ fontSize: '13px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✕</button>
        </div>
      )
    }

    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
            Proposal Breakdown{items.length > 0 ? ` (${items.length})` : ''}
          </div>
          <button onClick={() => setAddingLineItem(addingLineItem === vendor.id ? null : vendor.id)} style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {addingLineItem === vendor.id ? 'Cancel' : '+ Add item'}
          </button>
        </div>

        {addingLineItem === vendor.id && (
          <div style={{ padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '8px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '6px', marginBottom: '6px' }}>
              <input placeholder="Item description" value={newLineItem.label} onChange={e => setNewLineItem(f => ({ ...f, label: e.target.value, normalized_label: f.normalized_label || '' }))} style={{ fontSize: '12px' }} />
              <input type="number" placeholder="Amount" value={newLineItem.amount} onChange={e => setNewLineItem(f => ({ ...f, amount: e.target.value }))} style={{ fontSize: '12px' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button variant="secondary" onClick={() => { setAddingLineItem(null); setNewLineItem({ label: '', normalized_label: '', amount: '', quantity: '', unit: '' }) }}>Cancel</Button>
              <Button onClick={() => handleAddManualLineItem(vendor.id)} disabled={!newLineItem.label.trim()}>Add</Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visibleItems.map(renderItem)}
        </div>

        {showToggle && (
          <button
            onClick={() => setLineItemsExpanded(prev => ({ ...prev, [vendor.id]: !isExpanded }))}
            style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0', fontFamily: 'var(--font-body)', fontWeight: 500 }}
          >
            {isExpanded ? 'Show less ▴' : `Show all ${items.length} items ▾`}
          </button>
        )}

        {/* Total — always visible */}
        {items.some(i => i.amount != null) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px 0', borderTop: '1px solid var(--color-border)', marginTop: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2c2825' }}>Total</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-body)' }}>
              ${total.toLocaleString()}
            </span>
          </div>
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
          {visible.length >= 2 && !comparing && !comparePicking && (
            <button
              onClick={() => {
                // Pre-select all if 2-3 vendors, none if 4+
                if (visible.length <= 3) {
                  setComparedVendorIds(visible.map(v => v.id))
                } else {
                  setComparedVendorIds([])
                }
                setComparePickerMsg(null)
                setComparePicking(true)
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

      {/* ══════ VENDOR PICKER (pre-comparison) ══════ */}
      {comparePicking && !comparing && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, color: '#2C2825', margin: '0 0 4px' }}>Choose vendors to compare</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Select 2 or 3 vendors to see them side by side</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {visible.map(v => {
              const selected = comparedVendorIds.includes(v.id)
              const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.not_started
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setComparePickerMsg(null)
                    if (selected) {
                      setComparedVendorIds(prev => prev.filter(id => id !== v.id))
                    } else {
                      if (comparedVendorIds.length >= 3) {
                        setComparePickerMsg('You can compare up to 3 at a time. Deselect one to add another.')
                        return
                      }
                      setComparedVendorIds(prev => [...prev, v.id])
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '12px 16px', border: selected ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                    borderRadius: '10px', background: selected ? 'rgba(184,146,106,0.06)' : '#fff',
                    cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                    border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                    background: selected ? 'var(--color-accent)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    {selected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  {/* Avatar */}
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avColor(v.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{initials(v.name || 'UN')}</span>
                  </div>
                  {/* Name + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#2C2825', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name || 'Unnamed'}</div>
                    {v.contact_name && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{v.contact_name}</div>}
                  </div>
                  {/* Status badge */}
                  <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600, flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                  {/* Amount */}
                  <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#2C2825', flexShrink: 0, minWidth: '60px', textAlign: 'right' }}>
                    {v.booked_amount != null ? `$${v.booked_amount.toLocaleString()}` : ''}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Picker message */}
          {comparePickerMsg && (
            <div style={{ fontSize: '12px', color: 'var(--color-alert)', marginBottom: '12px' }}>{comparePickerMsg}</div>
          )}
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              disabled={comparedVendorIds.length < 2}
              onClick={() => {
                setComparePicking(false)
                setComparing(true)
              }}
              style={{
                fontSize: '13px', fontWeight: 600, padding: '8px 20px', borderRadius: '8px',
                background: comparedVendorIds.length >= 2 ? 'var(--color-accent)' : 'var(--color-border)',
                color: comparedVendorIds.length >= 2 ? '#fff' : 'var(--color-text-muted)',
                border: 'none', cursor: comparedVendorIds.length >= 2 ? 'pointer' : 'default',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s ease',
              }}
            >
              Compare Selected ({comparedVendorIds.length})
            </button>
            <button
              onClick={() => { setComparePicking(false); setComparedVendorIds([]) }}
              style={{ fontSize: '13px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════ COMPARISON VIEW ══════ */}
      {comparing && (() => {
        const compared = comparedVendorIds.map(id => vendors.find(v => v.id === id)).filter(Boolean) as Vendor[]
        if (compared.length < 2) { setComparing(false); return null }

        function handleBookFromCompare(vendorId: string) {
          const vendor = vendors.find(v => v.id === vendorId)
          setBookingForm({ totalCost: vendor?.booked_amount ? String(vendor.booked_amount) : '', depositAmount: '', depositDate: new Date().toISOString().split('T')[0], paidBy: 'couple', paymentMethod: '' })
          setBookingError(null)
          setBookingModal({ vendorId, vendorName: vendor?.name || 'this vendor' })
        }

        const CompareRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: '200px', flexShrink: 0, padding: '10px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#FAFAF8', display: 'flex', alignItems: 'flex-start' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <button
                onClick={() => setComparing(false)}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}
              >
                ← Back to list
              </button>
              {visible.length > 2 && (
                <button
                  onClick={() => { setComparing(false); setComparePicking(true); setComparePickerMsg(null) }}
                  style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}
                >
                  Change vendors
                </button>
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
                  const vDocCount = (vendor.contract_url ? 1 : 0) + (vendor.proposal_url ? 1 : 0)
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
                          {vDocCount > 0 ? `${vDocCount} document${vDocCount !== 1 ? 's' : ''}` : 'No documents'}
                        </div>
                        {/* Line Items Breakdown */}
                        {(lineItems[vendor.id] ?? []).length > 0 && (
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Proposal Breakdown</div>
                            {(lineItems[vendor.id] ?? []).map(item => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '12px' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{item.normalized_label}</span>
                                <span style={{ fontWeight: 600, color: '#2c2825' }}>{item.amount != null ? `$${item.amount.toLocaleString()}` : '—'}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 0', borderTop: '1px solid var(--color-border)', marginTop: '4px', fontSize: '12px', fontWeight: 700 }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Total</span>
                              <span style={{ color: '#2c2825' }}>${(lineItems[vendor.id] ?? []).reduce((s, i) => s + (i.amount ?? 0), 0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
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
                    const docCount = (vendor.contract_url ? 1 : 0) + (vendor.proposal_url ? 1 : 0)
                    return (
                      <Cell key={vendor.id}>
                        <span style={{ fontSize: '12px', color: docCount > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                          {docCount > 0 ? `${docCount} document${docCount !== 1 ? 's' : ''}` : 'No documents'}
                        </span>
                      </Cell>
                    )
                  })}
                </CompareRow>

                {/* Proposal Breakdown rows */}
                {(() => {
                  // Collect all unique normalized labels across compared vendors, with representative items for quantity/unit
                  const allLabels: { label: string; quantity: number | null; unit: string | null }[] = []
                  const seenLabels = new Set<string>()
                  compared.forEach(v => {
                    const items = lineItems[v.id] ?? []
                    items.forEach(item => {
                      if (!seenLabels.has(item.normalized_label)) {
                        seenLabels.add(item.normalized_label)
                        allLabels.push({ label: item.normalized_label, quantity: item.quantity, unit: item.unit })
                      }
                    })
                  })
                  if (allLabels.length === 0) return null
                  return (
                    <>
                      {/* Section header */}
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: '#F5F1EC' }}>
                        <div style={{ width: '200px', flexShrink: 0, padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Proposal Breakdown
                        </div>
                        <div style={{ flex: 1 }} />
                      </div>
                      {/* One row per normalized label — label in left column, amounts in vendor columns */}
                      {allLabels.map(({ label, quantity, unit }) => {
                        // Build label text with quantity/unit from whichever vendor has it
                        let displayLabel = label
                        let bestQty = quantity
                        let bestUnit = unit
                        compared.forEach(v => {
                          const item = (lineItems[v.id] ?? []).find(i => i.normalized_label === label)
                          if (item?.quantity && (!bestQty || item.quantity > bestQty)) {
                            bestQty = item.quantity
                            bestUnit = item.unit
                          }
                        })
                        if (bestQty) displayLabel += ` · ${bestQty}${bestUnit ? ` ${bestUnit}` : ''}`

                        return (
                          <div key={label} style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ width: '200px', flexShrink: 0, padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', background: '#FAFAF8', display: 'flex', alignItems: 'center' }}>
                              {displayLabel}
                            </div>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
                              {compared.map(vendor => {
                                const item = (lineItems[vendor.id] ?? []).find(i => i.normalized_label === label)
                                return (
                                  <Cell key={vendor.id}>
                                    <span style={{ fontSize: '15px', fontWeight: 600, color: item?.amount != null ? '#2c2825' : 'var(--color-text-muted)' }}>
                                      {item?.amount != null ? `$${item.amount.toLocaleString()}` : '—'}
                                    </span>
                                  </Cell>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      {/* Totals row */}
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ width: '200px', flexShrink: 0, padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', background: '#FAFAF8', display: 'flex', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
                          Total
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
                          {compared.map(vendor => {
                            const items = lineItems[vendor.id] ?? []
                            const total = items.reduce((s, i) => s + (i.amount ?? 0), 0)
                            return (
                              <Cell key={vendor.id} style={{ background: '#FAFAF8', borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#2c2825' }}>
                                  {items.length > 0 ? `$${total.toLocaleString()}` : '—'}
                                </span>
                              </Cell>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Action row */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ width: '200px', flexShrink: 0, background: '#FAFAF8' }} />
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
      {!comparing && !comparePicking && <>
      {/* AI Shortlist CTA — hidden once a vendor is booked */}
      {!hasBooked && <GlowBorder style={{ marginBottom: '16px' }}>
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
      </GlowBorder>}

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
      {(() => {
        const activeVendors = visible.filter(v => v.status !== 'eliminated')
        const eliminatedVendors = visible.filter(v => v.status === 'eliminated')
        return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', border: activeVendors.length > 0 ? '1px solid var(--color-border)' : 'none', borderRadius: '8px', overflow: 'hidden', background: '#fff', boxShadow: activeVendors.length > 0 ? '0 1px 4px rgba(0,0,0,0.05)' : 'none' }}>
        {activeVendors.map((vendor, idx) => {
          const isBooked = vendor.status === 'booked'
          const isExpanded = isBooked || expandedId === vendor.id
          const cfg = STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.not_started
          const displayName = vendor.name || 'Unnamed vendor'
          const isEditing = editingId === vendor.id
          const isLast = idx === activeVendors.length - 1

          return (
            <div key={vendor.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>

              {/* Tile row */}
              <div
                onClick={() => { if (!isBooked) { setExpandedId(isExpanded ? null : vendor.id); setEditingId(null) } }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: isBooked ? 'default' : 'pointer', background: isExpanded ? (isBooked ? 'rgba(139,158,126,0.06)' : '#F5F1EC') : '#fff', transition: 'background 0.1s', borderLeft: isBooked ? '3px solid #7B8F6B' : '3px solid transparent' }}
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
                  <span style={{ fontSize: '10px', padding: vendor.status === 'booked' ? '4px 11px' : '3px 9px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {cfg.label}
                  </span>
                  {vendor.booked_amount != null && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-heading)' }}>
                      ${vendor.booked_amount.toLocaleString()}
                    </span>
                  )}
                  {!isBooked && <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>}
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)', background: isBooked ? 'rgba(139,158,126,0.06)' : '#F5F1EC', borderLeft: isBooked ? '3px solid #7B8F6B' : '3px solid transparent' }}>
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

                  {/* Payment progress (booked only) */}
                  {vendor.status === 'booked' && !isEditing && renderPaymentProgress(vendor)}

                  {/* Payment schedule (booked only) */}
                  {vendor.status === 'booked' && !isEditing && renderPaymentSchedule(vendor)}

                  {/* Documents + notes for all vendors */}
                  {!isEditing && (
                    <>
                      {renderDocumentsSection(vendor)}
                      {renderLineItemsSection(vendor)}
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

      {/* Eliminated section */}
      {eliminatedVendors.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, flexShrink: 0 }}>Eliminated</div>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            {eliminatedVendors.map((vendor, idx) => {
              const isExpElim = expandedId === vendor.id
              const displayName = vendor.name || 'Unnamed vendor'
              const isEditing = editingId === vendor.id
              const isLast = idx === eliminatedVendors.length - 1
              return (
                <div key={vendor.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)', opacity: 0.55 }}>
                  <div
                    onClick={() => { setExpandedId(isExpElim ? null : vendor.id); setEditingId(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', cursor: 'pointer', background: isExpElim ? '#f5f0ef' : '#fafaf9', transition: 'background 0.1s', borderLeft: '3px solid transparent' }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#d0c8c5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{initials(displayName)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                    </div>
                    <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: '#EDEAE6', color: '#8A8179', fontWeight: 600 }}>Eliminated</span>
                    <span style={{ fontSize: '16px', color: 'var(--color-text-muted)', display: 'inline-block', transform: isExpElim ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                  </div>
                  {isExpElim && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)', background: '#f5f0ef', borderLeft: '3px solid transparent' }}>
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]" style={{ marginBottom: '12px' }}>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>Name</label>
                            <input style={{ display: 'block' }} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button onClick={() => handleSave(vendor.id)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {vendor.notes && (
                            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', marginBottom: '10px', lineHeight: 1.5 }}>{vendor.notes}</div>
                          )}
                          {renderDocumentsSection(vendor)}
                          {renderLineItemsSection(vendor)}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                            <select value={vendor.status} onChange={e => handleStatusChange(vendor.id, e.target.value as VendorStatus)} style={{ fontSize: '11px', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: '5px', padding: '3px 6px', background: '#fff' }}>
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => handleDelete(vendor.id)} style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Remove</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      </>
      )
      })()}
      </>}

      {/* Decision note modal */}
      {/* Eliminated note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 6px 0' }}>
              Mark as eliminated
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 18px 0' }}>
              Add a note about why you eliminated this vendor (optional).
            </p>
            <textarea
              autoFocus
              placeholder="e.g. Too expensive, already booked..."
              value={noteModal.note}
              onChange={e => setNoteModal(m => m ? { ...m, note: e.target.value } : m)}
              style={{ width: '100%', minHeight: '80px', fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', display: 'block', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setNoteModal(null)}>Cancel</Button>
              <Button onClick={handleStatusWithNote}>Eliminate</Button>
            </div>
          </div>
        </div>
      )}

      {/* Booking confirmation modal */}
      {bookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 4px 0' }}>
              Book {bookingModal.vendorName}?
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px 0' }}>
              Nice choice. Let's record the details.
            </p>

            {bookingError && (
              <div style={{ fontSize: '12px', color: '#C4785C', marginBottom: '12px', padding: '8px 12px', background: 'rgba(196,120,92,0.06)', border: '1px solid rgba(196,120,92,0.20)', borderRadius: '8px' }}>
                {bookingError}
              </div>
            )}

            {/* Total contract amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px', fontWeight: 700 }}>Total contract amount</label>
              <input
                type="number"
                autoFocus
                placeholder="e.g. 15000"
                value={bookingForm.totalCost}
                onChange={e => setBookingForm(f => ({ ...f, totalCost: e.target.value }))}
                style={{ display: 'block', width: '100%', fontSize: '14px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Deposit amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px', fontWeight: 700 }}>Deposit amount (if already paid)</label>
              <input
                type="number"
                placeholder="Leave blank if no deposit paid"
                value={bookingForm.depositAmount}
                onChange={e => setBookingForm(f => ({ ...f, depositAmount: e.target.value }))}
                style={{ display: 'block', width: '100%', fontSize: '14px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '3px 0 0 0' }}>Leave blank if no deposit has been paid yet.</p>
            </div>

            {/* Deposit details — only visible when deposit > 0 */}
            {Number(bookingForm.depositAmount) > 0 && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px', fontWeight: 700 }}>When was the deposit paid?</label>
                  <input
                    type="date"
                    value={bookingForm.depositDate}
                    onChange={e => setBookingForm(f => ({ ...f, depositDate: e.target.value }))}
                    style={{ display: 'block', width: '100%', fontSize: '14px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-[12px]" style={{ marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px', fontWeight: 700 }}>Who paid?</label>
                    <select
                      value={bookingForm.paidBy}
                      onChange={e => setBookingForm(f => ({ ...f, paidBy: e.target.value }))}
                      style={{ display: 'block', width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-body)', boxSizing: 'border-box', background: '#fff' }}
                    >
                      <option value="couple">Couple</option>
                      <option value="family_a">{couple?.family_a_name || 'Family A'}</option>
                      <option value="family_b">{couple?.family_b_name || 'Family B'}</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px', fontWeight: 700 }}>Payment method</label>
                    <select
                      value={bookingForm.paymentMethod}
                      onChange={e => setBookingForm(f => ({ ...f, paymentMethod: e.target.value }))}
                      style={{ display: 'block', width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-body)', boxSizing: 'border-box', background: '#fff' }}
                    >
                      <option value="">Select...</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="check">Check</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="venmo_zelle">Venmo/Zelle</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setBookingModal(null)}>Cancel</Button>
                <Button onClick={() => handleBookingConfirm(false)} disabled={bookingSaving} style={{ background: '#5A7A4A' }}>
                  {bookingSaving ? 'Saving...' : 'Confirm Booking'}
                </Button>
              </div>
              {!Number(bookingForm.depositAmount) && (
                <button
                  onClick={() => handleBookingConfirm(true)}
                  disabled={bookingSaving}
                  style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-body)', padding: 0 }}
                >
                  Skip deposit — just mark as booked
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Un-booking confirmation modal */}
      {unbookModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 6px 0' }}>
              Un-book {unbookModal.vendorName}?
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 18px 0' }}>
              This won't delete any recorded payments.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setUnbookModal(null)}>Cancel</Button>
              <Button onClick={handleUnbookConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
      {/* Eliminate other vendors prompt */}
      {eliminatePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,10,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '28px 32px', width: '440px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 400, margin: '0 0 6px 0' }}>
              Eliminate other vendors?
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 18px 0', lineHeight: 1.5 }}>
              You've booked {eliminatePrompt.vendorName}. Want to mark the other {categoryLabel.toLowerCase()} vendors as eliminated?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setEliminatePrompt(null)}>No, keep them</Button>
              <Button onClick={async () => {
                const others = vendors.filter(v => v.id !== eliminatePrompt.vendorId && v.status !== 'booked' && v.status !== 'eliminated' && v.name)
                try {
                  await Promise.all(others.map(v => updateVendorStatus(v.id, 'eliminated')))
                  setVendors(prev => prev.map(v => others.some(o => o.id === v.id) ? { ...v, status: 'eliminated' as VendorStatus } : v))
                } catch { /* best-effort */ }
                setEliminatePrompt(null)
              }}>Yes, eliminate others</Button>
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
      {/* ─── Extraction Confirmation Card ──────────────────────────────────── */}
      {extractionResult && (
        <div
          onClick={() => setExtractionResult(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: window.innerWidth < 768 ? '16px' : '40px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '560px', maxHeight: '80vh',
              background: '#fff', borderRadius: '12px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
              background: '#FDFBF8', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', color: '#2c2825' }}>
                    Review Extracted Details
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    from {extractionResult.fileName}
                  </div>
                </div>
                <button
                  onClick={() => setExtractionResult(null)}
                  style={{ fontSize: '18px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {/* Vendor Fields */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '8px' }}>
                  Vendor Information
                </div>
                {((): React.ReactNode => {
                  const fieldLabels: Record<string, string> = {
                    vendor_name: 'Vendor Name',
                    contact_name: 'Contact',
                    contact_email: 'Email',
                    contact_phone: 'Phone',
                    total_amount: 'Total Amount',
                    deposit_amount: 'Deposit',
                    deposit_due_date: 'Deposit Due',
                    balance_amount: 'Balance',
                    balance_due_date: 'Balance Due',
                    cancellation_summary: 'Cancellation Terms',
                  }
                  const fields = Object.entries(extractionResult.vendor_fields)
                    .filter(([key, v]) => v != null && v !== '' && key !== 'key_terms')
                  if (fields.length === 0) {
                    return <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No vendor fields found in document</div>
                  }
                  const allFieldsChecked = fields.every(([key]) => checkedFields[key])
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        <button
                          onClick={() => {
                            const next: Record<string, boolean> = {}
                            fields.forEach(([key]) => { next[key] = !allFieldsChecked })
                            setCheckedFields(prev => ({ ...prev, ...next }))
                          }}
                          style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {allFieldsChecked ? 'Uncheck all' : 'Select all'}
                        </button>
                      </div>
                      {fields.map(([key, value]: [string, unknown]) => {
                        const display = typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)
                        return (
                          <label
                            key={key}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0',
                              borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checkedFields[key] ?? false}
                              onChange={() => setCheckedFields(prev => ({ ...prev, [key]: !prev[key] }))}
                              style={{ marginTop: '2px', accentColor: 'var(--color-accent)', width: '16px', height: '16px', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                {fieldLabels[key] || key}
                              </div>
                              <div style={{ fontSize: '13px', color: '#2c2825', marginTop: '1px' }}>
                                {display}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </>
                  )
                })()}
              </div>

              {/* Key Terms */}
              {Array.isArray(extractionResult.vendor_fields.key_terms) && (extractionResult.vendor_fields.key_terms as string[]).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                    Key Terms
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(extractionResult.vendor_fields.key_terms as string[]).map((term, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#F5F1EC', color: 'var(--color-text-secondary)' }}>
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Line Items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    Line Items ({extractionResult.line_items.length})
                  </div>
                  <button
                    onClick={() => {
                      const allChecked = extractionResult.line_items.every((_, i) => checkedItems[i])
                      const next: Record<number, boolean> = {}
                      extractionResult.line_items.forEach((_, i) => { next[i] = !allChecked })
                      setCheckedItems(next)
                    }}
                    style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {extractionResult.line_items.every((_, i) => checkedItems[i]) ? 'Uncheck all' : 'Select all'}
                  </button>
                </div>

                {extractionResult.line_items.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No line items found in document</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {extractionResult.line_items.map((item, i) => (
                      <label
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          padding: '8px 10px', borderRadius: '7px',
                          background: checkedItems[i] ? 'rgba(184,146,106,0.04)' : 'var(--color-bg)',
                          border: `1px solid ${checkedItems[i] ? 'rgba(184,146,106,0.20)' : 'var(--color-border)'}`,
                          cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checkedItems[i] ?? false}
                          onChange={() => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))}
                          style={{ marginTop: '2px', accentColor: 'var(--color-accent)', width: '16px', height: '16px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2c2825' }}>{item.label}</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                            {item.normalized_label}
                            {item.quantity ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
                          {item.amount != null ? `$${item.amount.toLocaleString()}` : '—'}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Total for checked items */}
                {extractionResult.line_items.some((item, i) => checkedItems[i] && item.amount != null) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px 0', borderTop: '1px solid var(--color-border)', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Total</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2c2825', fontFamily: 'var(--font-body)' }}>
                      ${extractionResult.line_items
                        .filter((_, i) => checkedItems[i])
                        .reduce((s, i) => s + (i.amount ?? 0), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with actions */}
            {(() => {
              const noneSelected = !Object.values(checkedFields).some(Boolean) && !Object.values(checkedItems).some(Boolean)
              const applyDisabled = applyingExtraction || noneSelected
              return (
                <div style={{
                  padding: '12px 20px', borderTop: '1px solid var(--color-border)',
                  background: '#FDFBF8', flexShrink: 0,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <button
                    onClick={() => setExtractionResult(null)}
                    style={{ fontSize: '13px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyExtraction}
                    disabled={applyDisabled}
                    style={{
                      fontSize: '13px', fontWeight: 600, padding: '8px 20px', borderRadius: '8px',
                      background: applyDisabled ? '#D4CFC8' : 'var(--color-accent)',
                      color: '#fff', border: 'none',
                      cursor: applyDisabled ? 'default' : 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {applyingExtraction ? 'Applying...' : 'Apply Selected'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}
      {/* ─── Document Viewer Overlay ────────────────────────────────────────── */}
      {docViewer && (
        <div
          onClick={() => setDocViewer(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: window.innerWidth < 768 ? '16px' : '40px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '960px', height: '100%',
              background: '#fff', borderRadius: '12px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
              background: '#FDFBF8', flexShrink: 0,
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2825', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {docViewer.name}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <a
                  href={docViewer.url}
                  download={docViewer.name}
                  style={{ fontSize: '12px', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
                >
                  Download
                </a>
                <button
                  onClick={() => setDocViewer(null)}
                  style={{ fontSize: '18px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede8' }}>
              {docViewer.type === 'pdf' ? (
                <iframe
                  src={docViewer.url}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={docViewer.name}
                />
              ) : (
                <img
                  src={docViewer.url}
                  alt={docViewer.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
