import { useState } from 'react'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const FAMILY_A = 'Thompson Family'
const FAMILY_B = 'Rivera Family'
const BUDGET = 75000

const MOCK_VENDORS = [
  { id: 'v1',  category: 'venue',                  name: 'Brooklyn Winery',        status: 'booked',            booked_amount: 12000 },
  { id: 'v2',  category: 'photographer',            name: 'Marcus & Co',            status: 'booked',            booked_amount: 5500  },
  { id: 'v3',  category: 'hair_makeup',             name: 'Bloom Beauty Studio',    status: 'booked',            booked_amount: 3200  },
  { id: 'v4',  category: 'band_dj',                 name: 'The Brooklyn Collective', status: 'shortlisted',      booked_amount: null  },
  { id: 'v5',  category: 'band_dj',                 name: 'Seven Sounds',           status: 'shortlisted',       booked_amount: null  },
  { id: 'v6',  category: 'florist',                 name: 'Petal & Vine',           status: 'meeting_scheduled', booked_amount: null  },
  { id: 'v7',  category: 'caterer',                 name: 'The Harvest Table',      status: 'researching',       booked_amount: null  },
  { id: 'v8',  category: 'caterer',                 name: 'Urban Garden Co.',       status: 'researching',       booked_amount: null  },
  { id: 'v9',  category: 'videographer',            name: 'Golden Hour Films',      status: 'shortlisted',       booked_amount: null  },
  { id: 'v10', category: 'cake_desserts',           name: 'Sugar Atelier',          status: 'shortlisted',       booked_amount: null  },
  { id: 'v11', category: 'lighting',                name: 'Luminary Events',        status: 'researching',       booked_amount: null  },
  { id: 'v12', category: 'transportation',          name: null,                     status: 'not_started',       booked_amount: null  },
  { id: 'v13', category: 'invitations_stationery',  name: null,                     status: 'not_started',       booked_amount: null  },
  { id: 'v14', category: 'rehearsal_dinner',        name: 'The River Café',         status: 'researching',       booked_amount: null  },
  { id: 'v15', category: 'wedding_planner',         name: null,                     status: 'not_started',       booked_amount: null  },
  { id: 'v16', category: 'hotels',                  name: 'The Wythe Hotel',        status: 'researching',       booked_amount: null  },
]

const VENUE_VENDORS = [
  { id: 'vv1', name: 'Brooklyn Winery',   status: 'booked',            booked_amount: 12000, website: 'brooklynwinery.com',    notes: 'Confirmed Sept 14. Capacity 180. Beautiful industrial garden space.' },
  { id: 'vv2', name: 'The Foundry LIC',   status: 'shortlisted',       booked_amount: null,  website: 'thefoundrynyc.com',     notes: 'Exposed brick, skylight atrium. Great for 150 guests. Pending tour.' },
  { id: 'vv3', name: 'Greenpoint Loft',   status: 'shortlisted',       booked_amount: null,  website: 'greenpointloft.co',     notes: 'More affordable. Cap 120 — might be tight. Worth keeping as backup.' },
  { id: 'vv4', name: 'Elihu House',       status: 'meeting_scheduled', booked_amount: null,  website: 'elihuhouse.com',        notes: 'Meeting June 3 @ 2pm. Beautiful outdoor ceremony terrace.' },
  { id: 'vv5', name: 'The Wythe Pavilion',status: 'researching',       booked_amount: null,  website: 'wythehotel.com/events', notes: null },
]

const MOCK_PAYMENTS = [
  { id: 'p1', label: 'Venue Deposit',        amount: 3000, due_date: '2026-05-01', paid_date: '2026-05-01', paid_by: 'couple',   vendor_name: 'Brooklyn Winery'     },
  { id: 'p2', label: 'Venue Final Balance',  amount: 9000, due_date: '2026-06-15', paid_date: null,         paid_by: 'family_a', vendor_name: 'Brooklyn Winery'     },
  { id: 'p3', label: 'Photography Deposit',  amount: 2000, due_date: '2026-04-20', paid_date: '2026-04-20', paid_by: 'couple',   vendor_name: 'Marcus & Co'         },
  { id: 'p4', label: 'Photography Balance',  amount: 3500, due_date: '2026-08-12', paid_date: null,         paid_by: 'couple',   vendor_name: 'Marcus & Co'         },
  { id: 'p5', label: 'H&M Deposit',          amount: 800,  due_date: '2026-03-15', paid_date: '2026-03-15', paid_by: 'family_a', vendor_name: 'Bloom Beauty Studio' },
  { id: 'p6', label: 'H&M Final Balance',    amount: 2400, due_date: '2026-09-01', paid_date: null,         paid_by: 'family_a', vendor_name: 'Bloom Beauty Studio' },
  { id: 'p7', label: 'Florist Deposit',      amount: 1200, due_date: '2026-06-07', paid_date: null,         paid_by: 'family_b', vendor_name: 'Petal & Vine'        },
  { id: 'p8', label: 'Caterer Initial',      amount: 5000, due_date: '2026-07-01', paid_date: null,         paid_by: 'couple',   vendor_name: 'The Harvest Table'   },
]

const BY_FAMILY = {
  couple: [
    { label: 'Venue deposit', amount: 3000 },
    { label: 'Photography deposit', amount: 2000 },
    { label: 'Photography balance', amount: 3500 },
    { label: 'Caterer initial', amount: 5000 },
  ],
  family_a: [
    { label: 'H&M deposit', amount: 800 },
    { label: 'H&M final balance', amount: 2400 },
    { label: 'Venue final balance', amount: 9000 },
  ],
  family_b: [
    { label: 'Florist deposit', amount: 1200 },
  ],
}

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue', band_dj: 'Band / DJ', florist: 'Florist', photographer: 'Photographer',
  videographer: 'Videographer', caterer: 'Caterer', hair_makeup: 'Hair & Makeup',
  cake_desserts: 'Cake & Desserts', transportation: 'Transportation',
  invitations_stationery: 'Invitations', rehearsal_dinner: 'Rehearsal Dinner',
  wedding_planner: 'Wedding Planner', hotels: 'Hotels', lighting: 'Lighting',
}

const IN_PROGRESS = ['researching', 'shortlisted', 'meeting_scheduled']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return '$' + n.toLocaleString() }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function daysUntil(s: string) { return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000) }

const AV_COLORS = ['#c4788a','#5c9e8c','#7a8ec4','#c4a45c','#8e7ab5','#c47a5c','#5a9cc4']
function avColor(name: string) { return AV_COLORS[name.charCodeAt(0) % AV_COLORS.length] }

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  booked:            { bg: '#e8f5e9', color: '#2e7d32', label: 'Booked' },
  shortlisted:       { bg: '#fce4ec', color: '#b5506a', label: 'Shortlisted' },
  meeting_scheduled: { bg: '#fff3e0', color: '#c25a00', label: 'Meeting' },
  researching:       { bg: '#f0edff', color: '#6b4ec2', label: 'Researching' },
  not_started:       { bg: '#f0f0f0', color: '#888', label: 'Not started' },
}

function Chip({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: c.bg, color: c.color, borderRadius: 5, padding: '2px 7px', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, string> = { vendors: '⊞', venue: '🏛', finances: '◎' }

function Shell({ tab, setTab, children }: { tab: string; setTab: (t: string) => void; children: React.ReactNode }) {
  const tabStyle = (t: string): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingTop: 8, paddingBottom: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
    color: tab === t ? '#c4788a' : '#b0a89e', borderTop: tab === t ? '2px solid #c4788a' : '2px solid transparent',
    letterSpacing: '0.04em',
  })
  return (
    <div style={{ minHeight: '100dvh', background: '#faf7f4', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Demo banner */}
      <div style={{ background: '#2c2825', color: '#fff', fontSize: 11, textAlign: 'center', padding: '6px 12px', letterSpacing: '0.05em', fontWeight: 600 }}>
        ✦ DEMO MODE — Emma &amp; James · Sept 14, 2026 · {daysUntil('2026-09-14')} days
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 60 }}>{children}</div>
      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #e8e3dc', display: 'flex', zIndex: 100 }}>
        {(['vendors', 'venue', 'finances'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...tabStyle(t), border: 'none', background: 'none' }}>
            <span style={{ fontSize: 16 }}>{TAB_ICONS[t]}</span>
            <span>{t === 'venue' ? 'Venue' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Vendors Page ─────────────────────────────────────────────────────────────

function VendorsPage({ setTab }: { setTab: (t: string) => void }) {
  const categories = Object.keys(CATEGORY_LABELS)
  const categoryData = categories.map(cat => {
    const catVendors = MOCK_VENDORS.filter(v => v.category === cat)
    const booked = catVendors.find(v => v.status === 'booked')
    const active = catVendors.filter(v => IN_PROGRESS.includes(v.status))
    const state = booked ? 'booked' : active.length > 0 ? 'in_progress' : 'not_started'
    return { cat, booked, active, state }
  })
  const bookedCount = categoryData.filter(d => d.state === 'booked').length
  const activeCount = categoryData.filter(d => d.state === 'in_progress').length
  const todoCount = categoryData.filter(d => d.state === 'not_started').length
  const bookedPct = Math.round((bookedCount / categories.length) * 100)

  const tileStyle = (state: string): React.CSSProperties => {
    if (state === 'booked')     return { background: '#f0faf0', border: '1.5px solid #a5d6a7' }
    if (state === 'in_progress') return { background: '#fdf5f7', border: '1px solid #e8c4ce' }
    return { background: '#f5f5f5', border: '1px solid #e0e0e0' }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '18px 16px 10px', background: '#fff', borderBottom: '1px solid #ede8e2' }}>
        <div style={{ fontSize: 22, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#2c2825', marginBottom: 2 }}>Vendors</div>
        <div style={{ fontSize: 12, color: '#9a9088' }}>Brooklyn, NY · Sept 14, 2026</div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Summary bar */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#2c2825' }}>{bookedCount}</span>
              <span style={{ fontSize: 14, color: '#b0a89e' }}>/{categories.length}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', marginLeft: 4, background: '#e8f5e9', padding: '2px 7px', borderRadius: 5 }}>BOOKED</span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#c4788a', fontSize: 15 }}>{activeCount}</div>
                <div style={{ color: '#b0a89e', fontWeight: 600, letterSpacing: '0.04em' }}>ACTIVE</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#888', fontSize: 15 }}>{todoCount}</div>
                <div style={{ color: '#b0a89e', fontWeight: 600, letterSpacing: '0.04em' }}>TO DO</div>
              </div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#f0ede8', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${bookedPct}%`, background: '#4caf50', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          {categoryData.map(({ cat, booked, active, state }) => (
            <div key={cat} onClick={() => cat === 'venue' && setTab('venue')}
              style={{ ...tileStyle(state), borderRadius: 8, padding: '9px 10px', cursor: cat === 'venue' ? 'pointer' : 'default', position: 'relative' }}>
              {state === 'booked' && (
                <div style={{ position: 'absolute', top: 6, right: 7, fontSize: 8, fontWeight: 700, color: '#2e7d32', background: '#e8f5e9', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.05em' }}>
                  BOOKED
                </div>
              )}
              {state === 'in_progress' && active.length > 0 && (
                <div style={{ position: 'absolute', top: 6, right: 7, fontSize: 8, fontWeight: 700, color: '#c4788a', background: '#fce4ec', padding: '1px 5px', borderRadius: 4 }}>
                  {active.length}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: state === 'booked' ? 700 : 600, color: state === 'booked' ? '#1b5e20' : '#2c2825', lineHeight: 1.3, marginTop: 2 }}>
                {CATEGORY_LABELS[cat]}
              </div>
              {booked?.name && (
                <div style={{ fontSize: 10, color: '#5a8a5a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{booked.name}</div>
              )}
              {!booked && active.length > 0 && (
                <div style={{ fontSize: 10, color: '#c4788a', marginTop: 2 }}>
                  {active.filter(v => v.status === 'meeting_scheduled').length > 0 ? 'Meeting soon' :
                   `${active.length} option${active.length > 1 ? 's' : ''}`}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* AI nudge */}
        <div style={{ background: 'linear-gradient(135deg, #2c2825 0%, #4a3f3a 100%)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>4 categories need attention</div>
            <div style={{ fontSize: 11, color: '#c4b9b1' }}>AI can shortlist Band/DJ, Caterer, and Florist options in Brooklyn for you</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c4788a', background: '#fff', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Get picks →
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Venue Category Page (Tile Grid) ─────────────────────────────────────────

function VenuePage({ setTab }: { setTab: (t: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>('vv1')

  const booked = VENUE_VENDORS.filter(v => v.status === 'booked').length
  const active = VENUE_VENDORS.filter(v => IN_PROGRESS.includes(v.status)).length

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ede8e2', padding: '14px 16px 12px' }}>
        <button onClick={() => setTab('vendors')} style={{ fontSize: 12, color: '#c4788a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Vendors
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#2c2825' }}>Venue</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              {booked > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 5 }}>{booked} Booked</span>}
              {active > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#fce4ec', color: '#b5506a', padding: '2px 8px', borderRadius: 5 }}>{active} In Progress</span>}
              <span style={{ fontSize: 10, fontWeight: 600, color: '#9a9088', padding: '2px 4px' }}>{VENUE_VENDORS.length} venues tracked</span>
            </div>
          </div>
          <button style={{ fontSize: 11, fontWeight: 700, background: '#c4788a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
            + Add Venue
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* AI shortlist banner */}
        <div style={{ background: '#fff', border: '1px solid #e8c4ce', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2825' }}>AI found 3 more venues in Brooklyn</div>
            <div style={{ fontSize: 11, color: '#9a9088' }}>Based on your budget, capacity, and aesthetic</div>
          </div>
          <button style={{ fontSize: 11, fontWeight: 700, color: '#c4788a', background: '#fdf5f7', border: '1px solid #e8c4ce', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            See picks
          </button>
        </div>

        {/* Tiles */}
        {VENUE_VENDORS.map(v => {
          const isExpanded = expandedId === v.id
          const isBooked = v.status === 'booked'
          const tileBg = isBooked ? '#f0faf0' : isExpanded ? '#fff' : '#fff'
          const tileBorder = isBooked ? '1.5px solid #a5d6a7' : isExpanded ? '1.5px solid #c4788a' : '1px solid #e8e3dc'

          return (
            <div key={v.id} style={{ borderRadius: 12, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 10px rgba(0,0,0,0.09)' : '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s' }}>
              {/* Tile header — always visible */}
              <div onClick={() => setExpandedId(isExpanded ? null : v.id)}
                style={{ background: tileBg, border: tileBorder, borderBottom: isExpanded ? 'none' : tileBorder, borderRadius: isExpanded ? '12px 12px 0 0' : 12, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: avColor(v.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{initials(v.name)}</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2825', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: '#9a9088', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.website}</div>
                </div>
                {/* Right: chip + amount */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <Chip status={v.status} />
                  {v.booked_amount && <span style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>{fmt$(v.booked_amount)}</span>}
                </div>
                <span style={{ fontSize: 14, color: '#b0a89e', marginLeft: 2, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{ background: '#fff', border: tileBorder, borderTop: '1px solid #f0ede8', borderRadius: '0 0 12px 12px', padding: '12px 14px 14px' }}>
                  {v.notes && (
                    <div style={{ fontSize: 12, color: '#5a524c', lineHeight: 1.5, marginBottom: 12, padding: '10px 12px', background: '#faf7f4', borderRadius: 8 }}>
                      {v.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {v.status === 'booked' ? (
                      <>
                        <button style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#2e7d32', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '7px 0', cursor: 'pointer' }}>
                          View Contract
                        </button>
                        <button style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#2c2825', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 8, padding: '7px 0', cursor: 'pointer' }}>
                          Payments
                        </button>
                        <button style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#c4788a', background: '#fdf5f7', border: '1px solid #e8c4ce', borderRadius: 8, padding: '7px 0', cursor: 'pointer' }}>
                          AI Review
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#c4788a', background: '#fdf5f7', border: '1px solid #e8c4ce', borderRadius: 8, padding: '7px 0', cursor: 'pointer' }}>
                          Edit Details
                        </button>
                        <button style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#2e7d32', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '7px 0', cursor: 'pointer' }}>
                          Mark Booked ✓
                        </button>
                      </>
                    )}
                  </div>
                  {/* Payments for booked venue */}
                  {v.status === 'booked' && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9a9088', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Payments</div>
                      {MOCK_PAYMENTS.filter(p => p.vendor_name === v.name).map(p => {
                        const overdue = !p.paid_date && new Date(p.due_date) < new Date()
                        const soon = !p.paid_date && !overdue && daysUntil(p.due_date) <= 30
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f0ede8' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2825' }}>{p.label}</div>
                              <div style={{ fontSize: 11, color: '#9a9088' }}>
                                {p.paid_date ? `Paid ${fmtDate(p.paid_date)}` : `Due ${fmtDate(p.due_date)}`}
                                {overdue && <span style={{ color: '#c0392b', fontWeight: 700, marginLeft: 5 }}>OVERDUE</span>}
                                {soon && <span style={{ color: '#c25a00', fontWeight: 700, marginLeft: 5 }}>{daysUntil(p.due_date)}d</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: p.paid_date ? '#4caf50' : overdue ? '#c0392b' : '#2c2825' }}>{fmt$(p.amount)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <button style={{ width: '100%', fontSize: 12, fontWeight: 600, color: '#c4788a', background: 'none', border: '1.5px dashed #e8c4ce', borderRadius: 10, padding: '12px 0', cursor: 'pointer', marginTop: 2 }}>
          + Add another venue
        </button>
      </div>
    </div>
  )
}

// ─── Finances Page ────────────────────────────────────────────────────────────

function FinancesPage() {
  const paid = MOCK_PAYMENTS.filter(p => p.paid_date).reduce((s, p) => s + p.amount, 0)
  const unpaid = MOCK_PAYMENTS.filter(p => !p.paid_date)
  const scheduled = unpaid.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, BUDGET - paid - scheduled)
  const paidPct = Math.min((paid / BUDGET) * 100, 100)
  const schPct = Math.min((scheduled / BUDGET) * 100, 100 - paidPct)

  const nextDue = [...unpaid].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
  const today = new Date()

  const familyATotal = BY_FAMILY.family_a.reduce((s, p) => s + p.amount, 0)
  const familyBTotal = BY_FAMILY.family_b.reduce((s, p) => s + p.amount, 0)
  const coupleTotal = BY_FAMILY.couple.reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '18px 16px 10px', background: '#fff', borderBottom: '1px solid #ede8e2' }}>
        <div style={{ fontSize: 22, fontWeight: 400, fontFamily: 'Georgia, serif', color: '#2c2825', marginBottom: 2 }}>Finances</div>
        <div style={{ fontSize: 12, color: '#9a9088' }}>Payment tracking across all booked vendors</div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Consolidated summary tile */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9a9088', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Total Budget</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2825', fontFamily: 'Georgia, serif', lineHeight: 1 }}>{fmt$(BUDGET)}</div>
            </div>
            {nextDue && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#9a9088', marginBottom: 2 }}>Next due</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4788a' }}>
                  {fmt$(nextDue.amount)} <span style={{ fontSize: 10, fontWeight: 500 }}>{fmtDate(nextDue.due_date)}</span>
                </div>
              </div>
            )}
          </div>
          {/* 3-part progress bar */}
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 10 }}>
            <div style={{ width: `${paidPct}%`, background: '#4caf50', borderRadius: '4px 0 0 4px' }} />
            <div style={{ width: `${schPct}%`, background: '#c4788a' }} />
            <div style={{ flex: 1, background: '#f0ede8', borderRadius: '0 4px 4px 0' }} />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14 }}>
            {[{ color: '#4caf50', label: 'Paid', amount: paid }, { color: '#c4788a', label: 'Scheduled', amount: scheduled }, { color: '#e0dbd4', label: 'Remaining', amount: remaining }].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2825' }}>{fmt$(item.amount)}</div>
                  <div style={{ fontSize: 10, color: '#9a9088' }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert banner — florist deposit urgent */}
        <div style={{ border: '1px solid #fcd5d5', borderRadius: 10, padding: '12px 14px', background: '#fff5f5', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', marginBottom: 2 }}>
              Payment due in {daysUntil('2026-06-07')} days
            </div>
            <div style={{ fontSize: 12, color: '#2c2825' }}><strong>$1,200</strong> · Florist Deposit for <strong>Petal &amp; Vine</strong></div>
            <div style={{ fontSize: 11, color: '#9a9088', marginTop: 2 }}>Due June 7, 2026 · {FAMILY_B}</div>
          </div>
          <button style={{ fontSize: 10, fontWeight: 700, border: '1px solid #c0392b', borderRadius: 7, padding: '4px 10px', color: '#c0392b', background: 'none', cursor: 'pointer', flexShrink: 0 }}>
            Pay
          </button>
        </div>

        {/* By Family */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9a9088', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>By Family</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { key: 'couple', label: 'Couple', total: coupleTotal, items: BY_FAMILY.couple },
              { key: 'family_a', label: FAMILY_A, total: familyATotal, items: BY_FAMILY.family_a },
              { key: 'family_b', label: FAMILY_B, total: familyBTotal, items: BY_FAMILY.family_b },
            ].map(fam => (
              <div key={fam.key} style={{ border: '1px solid #e5e0d8', borderRadius: 10, padding: '11px 12px', background: '#fff' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a9088', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{fam.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2c2825', fontFamily: 'Georgia, serif', marginBottom: 8 }}>{fmt$(fam.total)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fam.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < fam.items.length - 1 ? 4 : 0, borderBottom: i < fam.items.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                      <span style={{ fontSize: 10, color: '#666' }}>{item.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#2c2825' }}>{fmt$(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment schedule */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9a9088', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Payment Schedule</div>
          <div style={{ border: '1px solid #e5e0d8', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {MOCK_PAYMENTS.map((p, i) => {
              const overdue = !p.paid_date && new Date(p.due_date) < today
              const soon = !p.paid_date && !overdue && daysUntil(p.due_date) <= 30
              const rowBg = p.paid_date ? '#fff' : overdue ? '#fff5f5' : soon ? '#fffbf4' : '#fff'
              const borderC = p.paid_date ? '#f0ede8' : overdue ? '#fff0f0' : soon ? '#fef6ec' : '#f0ede8'
              const paidByLabel = p.paid_by === 'couple' ? 'Couple' : p.paid_by === 'family_a' ? FAMILY_A : FAMILY_B
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < MOCK_PAYMENTS.length - 1 ? `1px solid ${borderC}` : 'none', background: rowBg }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2825' }}>{p.label}</span>
                      {overdue && <span style={{ fontSize: 9, color: '#c0392b', fontWeight: 700, background: '#fde8e8', padding: '1px 5px', borderRadius: 4 }}>OVERDUE</span>}
                      {soon && <span style={{ fontSize: 9, color: '#c25a00', fontWeight: 700, background: '#fef0e0', padding: '1px 5px', borderRadius: 4 }}>{daysUntil(p.due_date)}d</span>}
                      {p.paid_date && <span style={{ fontSize: 9, color: '#2e7d32', fontWeight: 700, background: '#e8f5e9', padding: '1px 5px', borderRadius: 4 }}>PAID</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a9088', marginTop: 1 }}>
                      {p.vendor_name} · {p.paid_date ? `Paid ${fmtDate(p.paid_date)}` : `Due ${fmtDate(p.due_date)}`} · {paidByLabel}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.paid_date ? '#4caf50' : overdue ? '#c0392b' : '#2c2825' }}>{fmt$(p.amount)}</span>
                    {!p.paid_date && (
                      <button style={{ fontSize: 10, border: `1px solid ${overdue ? '#c0392b' : '#e0dbd4'}`, borderRadius: 6, padding: '3px 8px', color: overdue ? '#c0392b' : '#888', background: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        Pay
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button style={{ display: 'inline-block', border: '1.5px solid #c4788a', borderRadius: 10, padding: '9px 22px', color: '#c4788a', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none' }}>
            + Add Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Demo() {
  const [tab, setTab] = useState('vendors')
  return (
    <Shell tab={tab} setTab={setTab}>
      {tab === 'vendors' && <VendorsPage setTab={setTab} />}
      {tab === 'venue'   && <VenuePage setTab={setTab} />}
      {tab === 'finances' && <FinancesPage />}
    </Shell>
  )
}
