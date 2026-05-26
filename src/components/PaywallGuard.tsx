import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoupleForUser } from '../lib/couple'

export default function PaywallGuard({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setChecked(true); return }
        const couple = await getCoupleForUser(user.id)
        setPaid(couple?.paid ?? false)
        setChecked(true)
      } catch {
        setChecked(true)
      }
    }
    check()
  }, [])

  if (!checked) return null
  if (!paid) return <Navigate to="/paywall" replace />
  return <>{children}</>
}
