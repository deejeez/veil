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
    const { couple_id, category, exclude_names, previously_suggested } = body
    const excludeNames: string[] = Array.isArray(exclude_names) ? exclude_names : []
    const prevSuggested: string[] = Array.isArray(previously_suggested) ? previously_suggested : []
    const allExcluded = [...new Set([...excludeNames, ...prevSuggested])]

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
      .select('city, state, vibe_profile, user_id_primary, user_id_partner, wedding_date')
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

    const weddingContext = (() => {
      if (!couple.wedding_date) return 'wedding date not set'
      const d = new Date(couple.wedding_date + 'T12:00:00')
      const month = d.getMonth() + 1
      const season = month >= 3 && month <= 5 ? 'spring'
        : month >= 6 && month <= 8 ? 'summer'
        : month >= 9 && month <= 11 ? 'fall'
        : 'winter'
      return `${season} ${d.getFullYear()} wedding (${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
    })()

    const vp = couple.vibe_profile
    const vibeDesc = vp
      ? [
          vp.vibes?.length ? `Vibe: ${vp.vibes.map((x: string) => x.replace(/_/g, ' ')).join(', ')}` : '',
          vp.aesthetic ? `Aesthetic: ${vp.aesthetic}` : '',
          vp.formality ? `Formality: ${vp.formality}` : '',
          vp.setting ? `Setting: ${vp.setting}` : '',
          vp.vibe_words?.length ? `Vibe words: ${vp.vibe_words.join(', ')}` : '',
          vp.music_style ? `Music style: ${vp.music_style}` : '',
          vp.priority ? `Top priority: ${vp.priority}` : '',
        ].filter(Boolean).join(' | ') || 'No vibe profile specified'
      : 'No vibe profile specified'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      // deno-lint-ignore no-explicit-any
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] as any,
      messages: [{
        role: 'user',
        content: `You are an expert wedding planner helping a couple find vendors. Be fast and concise.

Location: ${location}
Looking for: ${categoryLabel}
Wedding: ${weddingContext}
Couple's vibe: ${vibeDesc}

Suggest 5 real ${categoryLabel}s in or near ${location} that match this couple's style and wedding season. You may use web search briefly to confirm these are real businesses, but keep research minimal — do NOT research reviews or ratings.${allExcluded.length > 0 ? `\n\nDo NOT suggest any of these vendors (already added or previously shown): ${allExcluded.join(', ')}. Return 5 completely different suggestions.` : ''}

Respond with ONLY valid JSON in this exact format, no markdown, no citations inside the JSON:
{
  "vendors": [
    {
      "name": "Actual Business Name",
      "location": "City, State",
      "style_tags": "3-4 words max, e.g. garden-romantic, lush, textured",
      "price_range": "Estimated range for this city and wedding type, e.g. $12K–$20K",
      "description": "Max 2 sentences describing the vendor",
      "website": "https://website.com or empty string if unknown",
      "why_good_fit": "One sentence: why this vendor fits this couple's specific vibe and season"
    }
  ]
}`,
      }],
    })

    // Web search responses contain multiple content blocks (search calls,
    // results, text with citations). Find the JSON in the text blocks —
    // scan from the last block backwards, then fall back to joined text.
    const textBlocks = message.content.filter((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) throw new Error('Unexpected response type from AI')

    const tryParse = (source: string): { vendors?: unknown[] } | null => {
      const trimmed = source.trim()
      const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonSource = fenceMatch ? fenceMatch[1].trim() : trimmed
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed && Array.isArray(parsed.vendors) ? parsed : null
      } catch {
        return null
      }
    }

    let result: { vendors?: unknown[] } | null = null
    for (let bi = textBlocks.length - 1; bi >= 0 && !result; bi--) {
      result = tryParse(textBlocks[bi].text)
    }
    // Citations can split the final answer across multiple text blocks
    if (!result) result = tryParse(textBlocks.map(b => b.text).join(''))
    if (!result) throw new Error('AI response was not valid JSON')

    try {
      await supabase.from('ai_insights').insert({
        couple_id,
        type: 'vendor_shortlist',
        content: `AI shortlist for ${category} in ${location} (${weddingContext}): ${(result.vendors ?? []).map((v: { name: string }) => v.name).join(', ')}`,
      })
    } catch {} // non-critical logging, don't fail the request

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
