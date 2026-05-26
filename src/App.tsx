import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Paywall from './pages/Paywall'
import OnboardingStep1 from './pages/onboarding/Step1'
import OnboardingStep2 from './pages/onboarding/Step2'
import OnboardingStep3 from './pages/onboarding/Step3'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import Budget from './pages/Budget'
import Finances from './pages/Finances'
import Timeline from './pages/Timeline'
import AcceptInvite from './pages/AcceptInvite'
import AuthGuard from './components/AuthGuard'
import PaywallGuard from './components/PaywallGuard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/paywall" element={<AuthGuard><Paywall /></AuthGuard>} />
        <Route path="/onboarding/1" element={<AuthGuard><OnboardingStep1 /></AuthGuard>} />
        <Route path="/onboarding/2" element={<AuthGuard><OnboardingStep2 /></AuthGuard>} />
        <Route path="/onboarding/3" element={<AuthGuard><OnboardingStep3 /></AuthGuard>} />
        <Route path="/" element={<AuthGuard><PaywallGuard><Dashboard /></PaywallGuard></AuthGuard>} />
        <Route path="/vendors" element={<AuthGuard><PaywallGuard><Vendors /></PaywallGuard></AuthGuard>} />
        <Route path="/vendors/:category" element={<AuthGuard><PaywallGuard><VendorDetail /></PaywallGuard></AuthGuard>} />
        <Route path="/budget" element={<AuthGuard><PaywallGuard><Budget /></PaywallGuard></AuthGuard>} />
        <Route path="/finances" element={<AuthGuard><PaywallGuard><Finances /></PaywallGuard></AuthGuard>} />
        <Route path="/timeline" element={<AuthGuard><PaywallGuard><Timeline /></PaywallGuard></AuthGuard>} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
