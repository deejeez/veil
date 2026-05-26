import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { type Vendor, VENDOR_CATEGORY_LABELS, VENDOR_CATEGORIES } from '../types/database'

const IN_PROGRESS_STATUSES = ['researching', 'shortlisted', 'meeting_scheduled']

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const couple = await getCoupleForUser(user.id)
        if (!couple) return
        await seedDefaultVendorCategories(couple.id)
        setVendors(await getVendorsForCouple(couple.id))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const vendorsByCategory = VENDOR_CATEGORIES.map(cat => {
    const catVendors = vendors.filter(v => v.category === cat && v.status !== 'eliminated')
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

    return { category: cat, state, subLabel, activeCount: active.length }
  })

  const bookedCount = vendorsByCategory.filter(v => v.state === 'booked').length
  const activeCount = vendorsByCategory.filter(v => v.state === 'in_progress').length
  const notStartedCount = vendorsByCategory.filter(v => v.state === 'not_started').length
  const total = VENDOR_CATEGORIES.length

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '22px', fontWeight: 400, fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '3px' }}>Vendors</div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>Track and manage all your wedding vendors</div>
      </div>

      {/* Summary bar */}
      <div style={{ border: '1px solid #e5e0d8', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', background: '#fff', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', minWidth: '36px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            {bookedCount}<span style={{ fontSize: '11px', color: '#ccc' }}>/{total}</span>
          </div>
          <div style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Booked</div>
        </div>
        <div style={{ flex: 1, height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${(bookedCount / total) * 100}%`, height: '100%', background: '#4caf50', borderRadius: '3px' }} />
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
        {vendorsByCategory.map(({ category, state, subLabel, activeCount: cnt }) => {
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
                  {VENDOR_CATEGORY_LABELS[category as keyof typeof VENDOR_CATEGORY_LABELS]}
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
