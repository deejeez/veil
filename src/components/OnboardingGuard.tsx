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
        setComplete(couple?.onboarding_complete ?? false)
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
