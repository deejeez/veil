import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { getVendorsForCouple, seedDefaultVendorCategories } from '../lib/vendors'
import { Vendor, VENDOR_CATEGORY_LABELS, VENDOR_CATEGORIES } from '../types/database'

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

  // Group by category (one row per category, showing the booked/shortlisted vendor if any)
  const vendorsByCategory = VENDOR_CATEGORIES.map(cat => {
    const catVendors = vendors.filter(v => v.category === cat)
    const booked = catVendors.find(v => v.status === 'booked')
    const shortlisted = catVendors.filter(v => v.status === 'shortlisted')
    return { category: cat, booked, shortlistedCount: shortlisted.length, catVendors }
  })

  if (loading) return <AppShell><p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p></AppShell>

  return (
    <AppShell>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 400, marginBottom: '24px' }}>
        Vendors
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
        {vendorsByCategory.map(({ category, booked, shortlistedCount }) => (
          <Card
            key={category}
            className=""
            style={{ cursor: 'pointer', border: '1px solid var(--color-border)', padding: '16px', background: 'var(--color-surface)' }}
            onClick={() => navigate(`/vendors/${category}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
                  {VENDOR_CATEGORY_LABELS[category]}
                </p>
                {booked?.name && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {booked.name}
                  </p>
                )}
                {!booked && shortlistedCount > 0 && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {shortlistedCount} shortlisted
                  </p>
                )}
              </div>
              <StatusBadge status={booked ? 'booked' : shortlistedCount > 0 ? 'shortlisted' : 'not_started'} />
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
