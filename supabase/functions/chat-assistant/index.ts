import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const body = await req.json().catch(() => null)
    const messages = body?.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError('messages array is required', 400)
    }
    // Sanitize: only role + string content, last 30 turns
    const history = messages
      .filter((m: { role?: string; content?: unknown }) =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-30)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    if (history.length === 0) return jsonError('messages array is required', 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return jsonError('Unauthorized', 401)

    const { data: couple } = await supabase
      .from('couples')
      .select('*')
      .or(`user_id_primary.eq.${user.id},user_id_partner.eq.${user.id}`)
      .single()

    if (!couple) return jsonError('No couple found', 404)
    if (!couple.paid) return jsonError('Payment required', 402)

    const [
      { data: vendors },
      { data: budgetCategories },
      { data: payments },
      { data: guests },
      { data: lineItems },
      { data: milestones },
    ] = await Promise.all([
      supabase.from('vendors').select('*').eq('couple_id', couple.id),
      supabase.from('budget_categories').select('*').eq('couple_id', couple.id),
      supabase.from('payments').select('*').eq('couple_id', couple.id),
      supabase.from('guests').select('id, name, plus_ones, kids').eq('couple_id', couple.id),
      supabase.from('vendor_line_items').select('*').eq('couple_id', couple.id),
      supabase.from('milestone_completions').select('*').eq('couple_id', couple.id),
    ])

    const bookedVendors = (vendors ?? []).filter((v: { status: string }) => v.status === 'booked')
    const totalBudget = couple.budget_total ?? 0
    const totalCommitted = bookedVendors.reduce((s: number, v: { booked_amount: number | null }) => s + (v.booked_amount ?? 0), 0)
    const totalPaid = (payments ?? []).filter((p: { paid_date: string | null }) => p.paid_date)
      .reduce((s: number, p: { amount: number | null }) => s + (p.amount ?? 0), 0)
    const guestCount = (guests ?? []).reduce((s: number, g: { plus_ones: number | null; kids: number | null }) =>
      s + 1 + (g.plus_ones ?? 0) + (g.kids ?? 0), 0)
    const today = new Date().toISOString().split('T')[0]
    const overduePayments = (payments ?? []).filter((p: { paid_date: string | null; due_date: string | null }) =>
      !p.paid_date && p.due_date && p.due_date < today)
    const upcomingPayments = (payments ?? [])
      .filter((p: { paid_date: string | null; due_date: string | null }) => !p.paid_date && p.due_date && p.due_date >= today)
      .sort((a: { due_date: string }, b: { due_date: string }) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)

    const weddingDate = couple.wedding_date ? new Date(couple.wedding_date) : null
    const daysToGo = weddingDate ? Math.ceil((weddingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    const monthsOut = daysToGo ? Math.round(daysToGo / 30) : null

    const vp = couple.vibe_profile
    const vibeDesc = vp
      ? [
          vp.vibes?.length ? vp.vibes.map((x: string) => x.replace(/_/g, ' ')).join(', ') : '',
          vp.aesthetic ?? '',
          vp.formality ?? '',
          vp.setting ?? '',
          vp.priority ? `priority: ${vp.priority}` : '',
        ].filter(Boolean).join(', ') || 'Not set'
      : 'Not set'

    const budgetLines = (budgetCategories ?? [])
      .filter((b: { budgeted: number | null }) => (b.budgeted ?? 0) > 0)
      .map((b: { category: string; budgeted: number }) => `- ${b.category}: ${b.budgeted.toLocaleString()} budgeted`)
      .join('\n')

    const lineItemLines = (lineItems ?? []).slice(0, 40)
      .map((li: { vendor_id: string; label: string; amount: number | null }) => {
        const v = (vendors ?? []).find((x: { id: string }) => x.id === li.vendor_id)
        return `- ${v?.name ?? v?.category ?? 'vendor'}: ${li.label}${li.amount ? ` (${li.amount.toLocaleString()})` : ''}`
      }).join('\n')

    const milestoneLines = (milestones ?? [])
      .map((m: { milestone_key: string; completed_at: string | null }) =>
        `- ${m.milestone_key.replace(/_/g, ' ')} (${m.completed_at?.split('T')[0] ?? ''})`)
      .join('\n')

    const contextSummary = `
WEDDING CONTEXT:
- Couple: ${couple.name_primary ?? 'Unknown'} & ${couple.name_partner ?? 'Unknown'}
- Wedding date: ${couple.wedding_date ?? 'Not set'}${daysToGo !== null ? ` (${daysToGo} days away, ~${monthsOut} months out)` : ''}
- Today's date: ${today}
- City: ${couple.city ?? 'Not set'}${couple.state ? `, ${couple.state}` : ''}
- Venue: ${couple.venue_name ?? 'Not booked'}
- Vibe/style: ${vibeDesc}
- Guest count: ${guestCount > 0 ? guestCount : (couple.guest_count ?? 'Not set')}

BUDGET:
- Total budget: ${totalBudget > 0 ? `${totalBudget.toLocaleString()}` : 'Not set'}
- Total committed to vendors: ${totalCommitted.toLocaleString()}
- Total paid: ${totalPaid.toLocaleString()}
- Remaining to pay on commitments: ${(totalCommitted - totalPaid).toLocaleString()}
${totalBudget > 0 && totalCommitted > totalBudget ? `- WARNING: OVER BUDGET by ${(totalCommitted - totalBudget).toLocaleString()}` : ''}
${overduePayments.length > 0 ? `- WARNING: ${overduePayments.length} overdue payment(s)` : ''}
${budgetLines ? `Budget by category:\n${budgetLines}` : ''}

UPCOMING PAYMENTS:
${upcomingPayments.map((p: { label: string | null; amount: number | null; due_date: string }) =>
  `- ${p.label ?? 'Payment'}: ${(p.amount ?? 0).toLocaleString()} due ${p.due_date}`).join('\n') || 'None scheduled'}

VENDORS (${bookedVendors.length} booked of ${(vendors ?? []).length} total):
ALREADY-BOOKED CATEGORIES (these are DONE, do not suggest booking them): ${[...new Set(bookedVendors.map((v: { category: string }) => v.category))].join(', ') || 'none yet'}
${(vendors ?? []).map((v: { category: string; name: string | null; status: string; booked_amount: number | null }) =>
  `- ${v.category}: ${v.name ?? 'unnamed'} (${v.status})${v.booked_amount ? ` — ${v.booked_amount.toLocaleString()}` : ''}`).join('\n') || 'None added yet'}

${lineItemLines ? `VENDOR PROPOSAL/CONTRACT LINE ITEMS:\n${lineItemLines}` : ''}

MANUALLY COMPLETED MILESTONES (${(milestones ?? []).length} checked off by the couple):
${milestoneLines || 'None checked off yet'}
    `.trim()

    // Debug: verify the model sees correct vendor statuses (check with
    // `supabase functions logs chat-assistant`)
    console.log(`contextSummary for couple ${couple.id}:\n${contextSummary}`)

    const systemPrompt = `You are the AI wedding planner inside Veil. You have complete knowledge of this couple's wedding planning data.

${contextSummary}

RULES:
1. Be warm, direct, and knowledgeable. You're a trusted planner, not a generic chatbot.
2. Always reference their specific data. Don't give generic advice when you can give personalized advice.
3. Keep responses concise. 2-4 sentences for simple questions. Longer for complex ones, but never rambling.
4. When suggesting actions, include page links using this format: [[page_name|display_text]]. Examples:
   - [[/vendors/photographer|Go to Photographers]]
   - [[/budget|View your budget]]
   - [[/timeline|Check your timeline]]
   - [[/finances|Open Payment Tracker]] (the /finances page is called "Payment Tracker" in the app)
   - [[/vendors|Browse vendors]]
   - [[/guests|Guest list]]
   - [[/settings|Settings]]
5. Don't repeat information they can see on their dashboard. Add insight, not data.
6. If they ask about something you don't have data on, say so honestly.
7. No em dashes. No buzzwords. Write like a smart friend who happens to be a wedding planner.
8. If they seem stressed, acknowledge it briefly but stay practical. Don't be therapist-y.
9. For vendor recommendations or comparisons, reference their actual vendor data and line items when available.
10. Keep the conversation contextual. If they were just talking about florists, don't pivot to budget unless they do.
11. CRITICAL: Before suggesting any action related to vendors, CHECK the vendor list above. If a vendor category shows status 'booked', do NOT tell the user to book it. Acknowledge it's already handled.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: history,
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      console.error('Anthropic API error', response.status, detail)
      return jsonError('AI service error', 502)
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return jsonError(String(err), 500)
  }
})
