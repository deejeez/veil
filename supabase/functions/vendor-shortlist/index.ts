import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORY_LABEL: Record<string, string> = {
  venue: 'wedding venue',
  band_dj: 'wedding band or DJ',
  florist: 'wedding florist',
  photographer: 'wedding photographer',
  videographer: 'wedding videographer',
  caterer: 'wedding caterer',
  hair_makeup: 'hair and makeup artist',
  cake_desserts: 'wedding cake bakery',
  transportation: 'wedding transportation service',
  invitations_stationery: 'wedding invitation designer',
  rehearsal_dinner: 'private dining restaurant',
  wedding_planner: 'wedding planner or coordinator',
  hotels: 'hotel with wedding room blocks',
  lighting: 'wedding lighting and event production company',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => null)
    if (!body?.couple_id || !body?.category) {
      return new Response(JSON.stringify({ message: 'couple_id and category are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { couple_id, category } = body

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
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
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: couple } = await supabase
      .from('couples')
      .select('city, state, vibe_profile, user_id_primary, user_id_partner')
      .eq('id', couple_id)
      .single()

    if (couple?.user_id_primary !== user.id && couple?.user_id_partner !== user.id) {
      return new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!couple?.city) {
      return new Response(JSON.stringify({ message: 'Please set your city in your profile first before getting vendor suggestions.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const categoryLabel = CATEGORY_LABEL[category] ?? `wedding ${category}`
    const location = [couple.city, couple.state].filter(Boolean).join(', ')

    const vibeDesc = couple.vibe_profile
      ? [
          `Aesthetic: ${couple.vibe_profile.aesthetic}`,
          `Formality: ${couple.vibe_profile.formality}`,
          `Setting: ${couple.vibe_profile.setting}`,
          couple.vibe_profile.vibe_words?.length ? `Vibe words: ${couple.vibe_profile.vibe_words.join(', ')}` : '',
          `Music style: ${couple.vibe_profile.music_style}`,
          `Top priority: ${couple.vibe_profile.priority}`,
        ].filter(Boolean).join(' | ')
      : 'No vibe profile specified'

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are an expert wedding planner helping a couple find vendors.

Location: ${location}
Looking for: ${categoryLabel}
Couple's vibe: ${vibeDesc}

Suggest 5 real, well-reviewed ${categoryLabel}s in or near ${location} that match this couple's style. Use your knowledge of real businesses that actually exist in this city.

For each vendor, write one sentence explaining why they specifically match this couple's vibe and aesthetic.

Respond with ONLY valid JSON in this exact format, no markdown:
{
  "vendors": [
    {
      "name": "Actual Business Name",
      "address": "City, State (or full address if known)",
      "website": "https://website.com or empty string if unknown",
      "reason": "One sentence about why this matches their specific vibe."
    }
  ]
}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type from AI')

    // Strip markdown fences if present
    const raw = content.text.trim()
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = fenceMatch ? fenceMatch[1].trim() : raw
    const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI response was not valid JSON')
    const result = JSON.parse(jsonMatch[0])

    await supabase.from('ai_insights').insert({
      couple_id,
      type: 'vendor_shortlist',
      content: `AI shortlist for ${category} in ${location}: ${(result.vendors ?? []).map((v: { name: string }) => v.name).join(', ')}`,
    }).catch(() => {}) // non-critical

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('vendor-shortlist error:', err)
    return new Response(JSON.stringify({ message: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
