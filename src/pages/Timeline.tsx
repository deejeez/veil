import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import SectionLabel from '../components/SectionLabel'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'
import { track } from '../lib/analytics'

type TimelineResult = {
  overall_status: 'On Track' | 'At Risk' | 'Behind'
  summary: string
  urgent: { item: string; reason: string }[]
  on_track: string[]
  watch_list: { item: string; when: string }[]
}

const statusColors: Record<string, string> = {
  'On Track': 'var(--color-status-booked)',
  'At Risk': 'var(--color-status-short)',
  'Behind': '#B91C1C',
}

export default function Timeline() {
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coupleId, setCoupleId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const couple = await getCoupleForUser(user.id)
        if (couple) setCoupleId(couple.id)
      } catch {
        // silent fail — button will stay disabled
      }
    }
    init()
  }, [])

  async function checkTimeline() {
    if (!coupleId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('planning-timeline', {
        body: { couple_id: coupleId },
      })
      if (fnError) throw fnError
      setResult(data)
      track('timeline_checked', { overall_status: data.overall_status })
    } catch {
      setError("Couldn't generate timeline — try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 400, margin: 0 }}>
          Planning Timeline
        </h1>
        <Button onClick={checkTimeline} disabled={loading || !coupleId}>
          {loading ? 'Checking...' : result ? 'Refresh' : 'Check My Timeline'}
        </Button>
      </div>

      {error && <p style={{ color: '#B91C1C', fontFamily: 'var(--font-body)', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

      {!result && !loading && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Click "Check My Timeline" for a personalized assessment based on your wedding date, booked vendors, and vibe profile.
        </p>
      )}

      {result && (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 18px', borderRadius: '20px', border: `1.5px solid ${statusColors[result.overall_status]}`, background: `${statusColors[result.overall_status]}15`, marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: statusColors[result.overall_status], margin: 0, fontWeight: 600 }}>
              {result.overall_status}
            </p>
          </div>

          <Card style={{ marginBottom: '16px' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
              {result.summary}
            </p>
          </Card>

          {result.urgent.length > 0 && (
            <Card style={{ marginBottom: '16px', borderColor: '#B91C1C' }}>
              <SectionLabel>Urgent — Next 4 Weeks</SectionLabel>
              {result.urgent.map((item, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-bg)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>{item.item}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>{item.reason}</p>
                </div>
              ))}
            </Card>
          )}

          {result.on_track.length > 0 && (
            <Card style={{ marginBottom: '16px' }}>
              <SectionLabel>On Track</SectionLabel>
              {result.on_track.map((item, i) => (
                <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-status-booked)', margin: '0 0 4px 0' }}>
                  ✓ {item}
                </p>
              ))}
            </Card>
          )}

          {result.watch_list.length > 0 && (
            <Card>
              <SectionLabel>Watch List</SectionLabel>
              {result.watch_list.map((item, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-bg)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 2px 0' }}>{item.item}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{item.when}</p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </AppShell>
  )
}
