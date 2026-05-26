import posthog from 'posthog-js'

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY as string
  const host = import.meta.env.VITE_POSTHOG_HOST as string
  if (!key) return
  posthog.init(key, { api_host: host ?? 'https://us.i.posthog.com', capture_pageview: true })
}

export function track(event: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(event, properties)
  } catch {
    // Never let analytics break the app
  }
}

export function identifyUser(userId: string, email: string) {
  try {
    posthog.identify(userId, { email })
  } catch {
    // Never let analytics break the app
  }
}
