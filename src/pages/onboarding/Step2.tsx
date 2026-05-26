import { type CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoupleForUser, updateCouple } from '../../lib/couple'
import { type VibeProfile } from '../../types/database'
import Button from '../../components/Button'

const VIBE_WORDS = ['moody', 'airy', 'classic', 'wild', 'intimate', 'grand', 'playful', 'timeless', 'bold', 'soft']

export default function OnboardingStep2() {
  const [aesthetic, setAesthetic] = useState<VibeProfile['aesthetic']>('romantic')
  const [formality, setFormality] = useState<VibeProfile['formality']>('cocktail')
  const [setting, setSetting] = useState<VibeProfile['setting']>('ballroom')
  const [vibeWords, setVibeWords] = useState<string[]>([])
  const [musicStyle, setMusicStyle] = useState<VibeProfile['music_style']>('live_band')
  const [priority, setPriority] = useState<VibeProfile['priority']>('photography')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function toggleVibeWord(word: string) {
    setVibeWords(prev =>
      prev.includes(word)
        ? prev.filter(w => w !== word)
        : prev.length < 3 ? [...prev, word] : prev
    )
  }

  const selectStyle = (value: string, selected: string): CSSProperties => ({
    padding: '10px 16px',
    border: value === selected ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
    borderRadius: '10px',
    background: value === selected ? 'rgba(200,169,110,0.12)' : 'var(--color-surface)',
    color: value === selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: value === selected ? 500 : 400,
    transition: 'all 0.12s',
    width: 'auto',
    boxSizing: 'border-box' as const,
  })

  async function handleSubmit() {
    if (vibeWords.length < 3) { setError('Pick 3 vibe words'); return }
    setError(null)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const couple = await getCoupleForUser(user.id)
      if (!couple) throw new Error('Couple not found')

      const vibeProfile: VibeProfile = { aesthetic, formality, setting, vibe_words: vibeWords, music_style: musicStyle, priority }
      await updateCouple(couple.id, { vibe_profile: vibeProfile })
      navigate('/onboarding/3')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ((err as { message?: string }).message ?? 'Failed to save'))
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--color-text-secondary)',
    display: 'block', marginBottom: '8px', marginTop: '20px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: '580px', margin: '0 auto' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
          Step 2 of 3
        </p>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', marginBottom: '4px', fontWeight: 400 }}>
          Your vibe
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          This shapes every AI recommendation you get.
        </p>

        {error && <p style={{ color: '#B91C1C', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

        <label style={labelStyle}>Aesthetic</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['romantic', 'modern', 'rustic', 'industrial', 'maximalist', 'minimalist'] as const).map(a => (
            <button key={a} onClick={() => setAesthetic(a)} style={selectStyle(a, aesthetic)}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Formality</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['black_tie', 'cocktail', 'garden_party', 'casual'] as const).map(f => (
            <button key={f} onClick={() => setFormality(f)} style={selectStyle(f, formality)}>
              {f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Setting</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['urban_venue', 'countryside', 'beach', 'ballroom', 'restaurant'] as const).map(s => (
            <button key={s} onClick={() => setSetting(s)} style={selectStyle(s, setting)}>
              {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Vibe Words — pick 3 ({vibeWords.length}/3)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {VIBE_WORDS.map(word => (
            <button key={word} onClick={() => toggleVibeWord(word)}
              style={selectStyle(word, vibeWords.includes(word) ? word : '')}>
              {word}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Music Style</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['live_band', 'dj', 'acoustic', 'classical', 'mixed'] as const).map(m => (
            <button key={m} onClick={() => setMusicStyle(m)} style={selectStyle(m, musicStyle)}>
              {m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <label style={labelStyle}>What matters most</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['food', 'photography', 'flowers', 'music', 'decor'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)} style={selectStyle(p, priority)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={loading} style={{ marginTop: '32px', width: '100%' }}>
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
