import { type ReactNode, useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { supabase } from '../lib/supabase'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [latestInsight, setLatestInsight] = useState<string | null>(null)

  useEffect(() => {
    async function loadInsight() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: couple } = await supabase
        .from('couples')
        .select('id')
        .eq('user_id_primary', user.id)
        .maybeSingle()

      if (!couple) {
        const { data: partnerCouple } = await supabase
          .from('couples')
          .select('id')
          .eq('user_id_partner', user.id)
          .maybeSingle()
        if (!partnerCouple) return
        await loadInsightForCouple(partnerCouple.id)
        return
      }
      await loadInsightForCouple(couple.id)
    }

    async function loadInsightForCouple(coupleId: string) {
      const { data } = await supabase
        .from('ai_insights')
        .select('content')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setLatestInsight(data.content)
    }

    loadInsight()
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar latestInsight={latestInsight} />
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
