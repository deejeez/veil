import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

const CHARCOAL = '#2C2420'
const CREAM = '#FAF7F2'
const GOLD = '#C9A96E'
const GOLD_TEXT = '#B8944F'
const BORDER = '#E8E0D5'

const QUICK_ACTIONS = [
  'What should I focus on this week?',
  'Am I on track with my planning?',
  'How does my budget look?',
  'Help me decide between vendors',
]

function storageKey(coupleId: string) {
  return `veil_chat_${coupleId}`
}

function loadHistory(coupleId: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(storageKey(coupleId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m: ChatMsg) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    )
  } catch {
    return []
  }
}

function saveHistory(coupleId: string, msgs: ChatMsg[]) {
  try {
    const clean = msgs.filter(m => !m.error && m.content).slice(-50)
    localStorage.setItem(storageKey(coupleId), JSON.stringify(clean))
  } catch {
    // localStorage full or unavailable; chat still works in memory
  }
}

/* ---------- icons ---------- */

function PathIcon({ path }: { path: string }) {
  const p = {
    width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  }
  if (path.startsWith('/budget')) return <svg {...p}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  if (path.startsWith('/vendors')) return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (path.startsWith('/finances')) return <svg {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  if (path.startsWith('/timeline')) return <svg {...p}><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  if (path.startsWith('/guests')) return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
  if (path.startsWith('/venue')) return <svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  if (path.startsWith('/settings')) return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8"/></svg>
  return <svg {...p}><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}

/* ---------- message content rendering ---------- */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/\*\*([^*]+)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={`${keyPrefix}-b${i}`} style={{ fontWeight: 600 }}>{part}</strong>
      : <span key={`${keyPrefix}-t${i}`}>{part}</span>
  )
}

function renderTextBlock(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      if (i > 0 && i < lines.length - 1) nodes.push(<div key={`${keyPrefix}-sp${i}`} style={{ height: 8 }} />)
      return
    }
    const bullet = /^[-•]\s+/.test(trimmed)
    if (bullet) {
      nodes.push(
        <div key={`${keyPrefix}-l${i}`} style={{ display: 'flex', gap: 8, padding: '1px 0' }}>
          <span style={{ color: GOLD_TEXT, flexShrink: 0 }}>•</span>
          <span style={{ minWidth: 0 }}>{renderInline(trimmed.replace(/^[-•]\s+/, ''), `${keyPrefix}-l${i}`)}</span>
        </div>
      )
    } else {
      nodes.push(<div key={`${keyPrefix}-l${i}`}>{renderInline(trimmed, `${keyPrefix}-l${i}`)}</div>)
    }
  })
  return nodes
}

function AssistantContent({ content, onAction }: { content: string; onAction: (path: string) => void }) {
  const segments = content.split(/(\[\[[^\]]*\]\])/g)
  return (
    <>
      {segments.map((seg, i) => {
        const match = seg.match(/^\[\[([^|\]]+)\|([^\]]+)\]\]$/)
        if (match) {
          const [, path, label] = match
          return (
            <button
              key={`seg${i}`}
              onClick={() => onAction(path.trim())}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                border: `1px solid ${GOLD}66`, borderRadius: 8, padding: '8px 12px',
                margin: '6px 0', background: '#FDFAF5', color: GOLD_TEXT,
                fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F7EFE2' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FDFAF5' }}
            >
              <PathIcon path={path.trim()} />
              <span style={{ flex: 1, minWidth: 0 }}>{label.trim()}</span>
              <span aria-hidden style={{ flexShrink: 0 }}>→</span>
            </button>
          )
        }
        if (!seg) return null
        return <span key={`seg${i}`} style={{ display: 'block' }}>{renderTextBlock(seg, `seg${i}`)}</span>
      })}
    </>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="veil-chat-dot" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  )
}

/* ---------- main panel ---------- */

export default function ChatPanel({
  coupleId,
  open,
  onMinimize,
}: {
  coupleId: string
  open: boolean
  onMinimize: () => void
}) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadHistory(coupleId))
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pending, setPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, open])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 320)
  }, [open])

  async function runAssistant(history: ChatMsg[]) {
    setStreaming(true)
    setPending(true)
    setMessages([...history, { role: 'assistant', content: '' }])
    let acc = ''
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          let evt: { type?: string; delta?: { type?: string; text?: string } }
          try { evt = JSON.parse(payload) } catch { continue }
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            acc += evt.delta.text
            setPending(false)
            setMessages(prev => {
              const next = prev.slice()
              next[next.length - 1] = { role: 'assistant', content: acc }
              return next
            })
          }
        }
      }
      if (!acc.trim()) throw new Error('Empty response')
      saveHistory(coupleId, [...history, { role: 'assistant', content: acc }])
    } catch {
      setMessages(prev => {
        const next = prev.slice()
        next[next.length - 1] = { role: 'assistant', content: '', error: true }
        return next
      })
      saveHistory(coupleId, history)
    } finally {
      setStreaming(false)
      setPending(false)
    }
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    const history: ChatMsg[] = [
      ...messages.filter(m => !m.error && m.content),
      { role: 'user', content: trimmed },
    ]
    saveHistory(coupleId, history)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    track('chat_message_sent')
    runAssistant(history)
  }

  function retry() {
    const clean = messages.filter(m => !m.error && m.content)
    const lastUserIdx = clean.map(m => m.role).lastIndexOf('user')
    if (lastUserIdx === -1) return
    runAssistant(clean.slice(0, lastUserIdx + 1))
  }

  function handleAction(path: string) {
    track('chat_action_link_clicked', { path })
    navigate(path)
    onMinimize()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showWelcome = messages.length === 0

  return (
    <div
      className="veil-chat-panel"
      role="dialog"
      aria-label="Veil wedding planner chat"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 92,
        width: 400,
        height: 'min(600px, calc(100vh - 120px))',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px 16px 0 0',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(44, 36, 32, 0.18)',
        background: CREAM,
        transition: 'transform 300ms ease-out, opacity 300ms ease-out, visibility 300ms',
        transform: open ? 'translateY(0)' : 'translateY(20px)',
        opacity: open ? 1 : 0,
        visibility: open ? 'visible' : 'hidden',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <style>{`
        .veil-chat-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: ${GOLD_TEXT}; display: inline-block;
          animation: veilChatDotPulse 1s ease-in-out infinite;
        }
        @keyframes veilChatDotPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .veil-chat-messages::-webkit-scrollbar { width: 6px; }
        .veil-chat-messages::-webkit-scrollbar-thumb { background: #D9D0C3; border-radius: 3px; }
        .veil-chat-pill:active { background: #F7EFE2 !important; }
        @media (max-width: 640px) {
          .veil-chat-panel {
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            height: 80vh !important;
            bottom: 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: CHARCOAL, padding: '16px 20px', display: 'flex',
        alignItems: 'center', gap: 12, flexShrink: 0, borderRadius: '16px 16px 0 0',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: GOLD,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.7a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 500 }}>Veil</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', fontSize: 12 }}>Your wedding planner</div>
        </div>
        <button
          onClick={onMinimize}
          aria-label="Minimize chat"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: 'rgba(255,255,255,0.6)', display: 'flex',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" x2="19" y1="12" y2="12"/></svg>
        </button>
        <button
          onClick={onMinimize}
          aria-label="Close chat"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: 'rgba(255,255,255,0.6)', display: 'flex',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="veil-chat-messages"
        style={{
          flex: 1, overflowY: 'auto', padding: 16, background: CREAM,
          display: 'flex', flexDirection: 'column', gap: 10, scrollBehavior: 'smooth',
        }}
      >
        {showWelcome && (
          <div style={{
            background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '16px 16px 16px 4px',
            maxWidth: '85%', padding: '12px 16px', alignSelf: 'flex-start',
            fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: CHARCOAL,
          }}>
            <div>Hey! I'm your Veil planner. I know your wedding details, vendors, budget, and timeline, so ask me anything. A few things I can help with:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0' }}>
              {QUICK_ACTIONS.map(q => (
                <button
                  key={q}
                  className="veil-chat-pill"
                  onClick={() => sendMessage(q)}
                  disabled={streaming}
                  style={{
                    border: `1px solid ${BORDER}`, borderRadius: 20, padding: '6px 14px',
                    fontSize: 12, color: GOLD_TEXT, background: '#fff', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 500, transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FDFAF5' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                >
                  {q}
                </button>
              ))}
            </div>
            <div>What's on your mind?</div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{
                alignSelf: 'flex-end', background: CHARCOAL, color: '#fff',
                borderRadius: '16px 16px 4px 16px', maxWidth: '80%', padding: '10px 14px',
                fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            )
          }
          if (m.error) {
            return (
              <div key={i} style={{
                alignSelf: 'flex-start', background: '#fff', border: `1px solid ${BORDER}`,
                borderRadius: '16px 16px 16px 4px', maxWidth: '85%', padding: '12px 16px',
                fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: CHARCOAL,
              }}>
                <div style={{ marginBottom: 8 }}>Something went wrong. Try again?</div>
                <button
                  onClick={retry}
                  disabled={streaming}
                  style={{
                    border: `1px solid ${GOLD}66`, borderRadius: 8, padding: '6px 14px',
                    background: '#FDFAF5', color: GOLD_TEXT, fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font-body)', cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )
          }
          const isStreamingPlaceholder = i === messages.length - 1 && pending && !m.content
          return (
            <div key={i} style={{
              alignSelf: 'flex-start', background: '#fff', border: `1px solid ${BORDER}`,
              borderRadius: '16px 16px 16px 4px', maxWidth: '85%', padding: '12px 16px',
              fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: CHARCOAL,
              wordBreak: 'break-word',
            }}>
              {isStreamingPlaceholder
                ? <TypingDots />
                : <AssistantContent content={m.content} onAction={handleAction} />}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{
        background: '#fff', borderTop: `1px solid ${BORDER}`, padding: '12px 16px',
        display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask anything about your wedding..."
          style={{
            flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px',
            fontSize: 13, fontFamily: 'var(--font-body)', color: CHARCOAL, resize: 'none',
            outline: 'none', lineHeight: 1.5, maxHeight: 96, background: '#fff',
          }}
        />
        {input.trim() && (
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming}
            aria-label="Send message"
            style={{
              width: 36, height: 36, borderRadius: '50%', background: GOLD, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: streaming ? 'default' : 'pointer', flexShrink: 0,
              opacity: streaming ? 0.5 : 1, transition: 'opacity 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="19" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
