import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Paywall from './pages/Paywall'
import OnboardingStep1 from './pages/onboarding/Step1'
import OnboardingStep2 from './pages/onboarding/Step2'
import OnboardingStep3 from './pages/onboarding/Step3'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import Budget from './pages/Budget'
import Finances from './pages/Finances'
import Venue from './pages/Venue'
import Timeline from './pages/Timeline'
import Todos from './pages/Todos'
import Settings from './pages/Settings'
import GuestList from './pages/GuestList'
import PaymentSuccess from './pages/PaymentSuccess'
import AcceptInvite from './pages/AcceptInvite'
import Demo from './pages/Demo'
import AuthGuard from './components/AuthGuard'
import PaywallGuard from './components/PaywallGuard'
import OnboardingGuard from './components/OnboardingGuard'
import ChatAssistant from './components/ChatAssistant'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/paywall" element={<AuthGuard><Paywall /></AuthGuard>} />
        <Route path="/onboarding/1" element={<AuthGuard><PaywallGuard><OnboardingStep1 /></PaywallGuard></AuthGuard>} />
        <Route path="/onboarding/2" element={<AuthGuard><PaywallGuard><OnboardingStep2 /></PaywallGuard></AuthGuard>} />
        <Route path="/onboarding/3" element={<AuthGuard><PaywallGuard><OnboardingStep3 /></PaywallGuard></AuthGuard>} />
        <Route path="/payment-success" element={<AuthGuard><PaymentSuccess /></AuthGuard>} />
        <Route path="/" element={<AuthGuard><PaywallGuard><OnboardingGuard><Dashboard /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/vendors" element={<AuthGuard><PaywallGuard><OnboardingGuard><Vendors /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/vendors/:category" element={<AuthGuard><PaywallGuard><OnboardingGuard><VendorDetail /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/venue" element={<AuthGuard><PaywallGuard><OnboardingGuard><Venue /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/guests" element={<AuthGuard><PaywallGuard><OnboardingGuard><GuestList /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/budget" element={<AuthGuard><PaywallGuard><OnboardingGuard><Budget /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/finances" element={<AuthGuard><PaywallGuard><OnboardingGuard><Finances /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/timeline" element={<AuthGuard><PaywallGuard><OnboardingGuard><Timeline /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/todos" element={<AuthGuard><PaywallGuard><OnboardingGuard><Todos /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><PaywallGuard><OnboardingGuard><Settings /></OnboardingGuard></PaywallGuard></AuthGuard>} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatAssistant />
    </BrowserRouter>
  )
}
