import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => null)
    if (!body?.couple_id) {
      return new Response(JSON.stringify({ error: 'couple_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { couple_id } = body

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: couple }, { data: vendors }, { data: budgetCategories }, { data: payments }, { data: guests }] = await Promise.all([
      supabase.from('couples').select('*, user_id_primary, user_id_partner, paid').eq('id', couple_id).single(),
      supabase.from('vendors').select('category, status, name, booked_amount').eq('couple_id', couple_id),
      supabase.from('budget_categories').select('category, budgeted').eq('couple_id', couple_id),
      supabase.from('payments').select('label, amount, due_date, paid_date').eq('couple_id', couple_id),
      supabase.from('guests').select('id, plus_ones, kids').eq('couple_id', couple_id),
    ])

    if (couple?.user_id_primary !== user.id && couple?.user_id_partner !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!couple.paid) {
      return new Response(JSON.stringify({ error: 'Payment required' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const daysUntil = couple.wedding_date
      ? Math.ceil((new Date(couple.wedding_date).getTime() - Date.now()) / 86400000)
      : null

    const vendorSummary = (vendors ?? []).map((v: { category: string; status: string; name: string | null }) =>
      `${v.category}: ${v.status}${v.name ? ` (${v.name})` : ''}`
    ).join('\n')

    const totalCommitted = (vendors ?? []).reduce((s: number, v: any) => s + (v.booked_amount ?? 0), 0)
    const totalBudgeted = (budgetCategories ?? []).reduce((s: number, b: any) => s + (b.budgeted ?? 0), 0)
    const today = new Date().toISOString().split('T')[0]
    const overduePayments = (payments ?? []).filter((p: any) => !p.paid_date && p.due_date && p.due_date < today)
    const overdueAmount = overduePayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
    const paidCount = (payments ?? []).filter((p: any) => p.paid_date).length
    const totalGuests = (guests ?? []).reduce((s: number, g: any) => s + 1 + (g.plus_ones ?? 0) + (g.kids ?? 0), 0)

    const vibeDesc = couple.vibe_profile
      ? `Aesthetic: ${couple.vibe_profile.aesthetic}, Formality: ${couple.vibe_profile.formality}, Setting: ${couple.vibe_profile.setting}, Priority: ${couple.vibe_profile.priority}`
      : 'No vibe profile'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a wedding planning advisor. Give a frank, specific planning assessment.

Wedding: ${couple.wedding_date ?? 'date not set'} (${daysUntil !== null ? `${daysUntil} days away` : 'date unknown'})
City: ${couple.city ?? 'unknown'}, ${couple.state ?? ''}
Vibe: ${vibeDesc}

Vendor status:
${vendorSummary || 'No vendors added yet'}

Budget: ${couple.budget_total ? `${couple.budget_total.toLocaleString()} total` : 'No budget set'}
Committed to booked vendors: ${totalCommitted.toLocaleString()}
Budgeted across categories: ${totalBudgeted.toLocaleString()}

Payments: ${(payments ?? []).length} total, ${paidCount} paid, ${overduePayments.length} overdue (${overdueAmount.toLocaleString()} overdue)

Guests: ${totalGuests} estimated

Respond in this exact JSON format:
{
  "overall_status": "On Track",
  "summary": "2-3 sentence plain English assessment",
  "urgent": [
    { "item": "specific task", "reason": "why urgent now" }
  ],
  "on_track": ["what is already handled"],
  "watch_list": [
    { "item": "task to watch", "when": "when it becomes urgent" }
  ]
}

overall_status must be exactly one of: "On Track", "Needs Attention", "Behind"`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')
    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = (fenceMatch ? fenceMatch[1] : content.text).trim()
    let result
    try {
      result = JSON.parse(jsonSource)
    } catch {
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      result = JSON.parse(jsonMatch[0])
    }

    await supabase.from('ai_insights').insert({
      couple_id,
      type: 'timeline_check',
      content: result.summary ?? '',
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
