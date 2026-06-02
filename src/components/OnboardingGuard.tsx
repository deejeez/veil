import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'

export default function OnboardingGuard({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [complete, setComplete] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setChecked(true); return }

        const couple = await getCoupleForUser(user.id)
        if (!couple) { setChecked(true); return }

        // Explicit flag set by the new onboarding flow
        if (couple.onboarding_complete) {
          setComplete(true)
          setChecked(true)
          return
        }

        // Backward-compat: existing users have data but no flag.
        // Check wedding_date on the couple row, then vendors and budget
        // in parallel — any data present means they've been through setup.
        if (couple.wedding_date) {
          setComplete(true)
          setChecked(true)
          return
        }

        const [vendorsRes, budgetRes] = await Promise.all([
          supabase.from('vendors').select('id').eq('couple_id', couple.id).limit(1),
          supabase.from('budget_categories').select('id').eq('couple_id', couple.id).limit(1),
        ])

        const hasVendors = (vendorsRes.data?.length ?? 0) > 0
        const hasBudget  = (budgetRes.data?.length ?? 0)  > 0

        setComplete(hasVendors || hasBudget)
        setChecked(true)
      } catch {
        setChecked(true)
      }
    }
    check()
  }, [])

  if (!checked) return null
  if (!complete) return <Navigate to="/onboarding/1" replace />
  return <>{children}</>
}
