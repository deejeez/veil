import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getSession } from '../lib/auth'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    getSession().then(session => {
      setAuthenticated(!!session)
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  if (!authenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
