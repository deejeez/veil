import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
const GOOGLE_PLACES_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORY_QUERY: Record<string, string> = {
  venue: 'wedding venue',
  band_dj: 'wedding band DJ',
  florist: 'wedding florist',
  photographer: 'wedding photographer',
  videographer: 'wedding videographer',
  caterer: 'wedding caterer',
  hair_makeup: 'wedding hair makeup artist',
  cake_desserts: 'wedding cake bakery',
  transportation: 'wedding limousine transportation',
  invitations_stationery: 'wedding stationery design',
  rehearsal_dinner: 'private dining event restaurant',
  wedding_planner: 'wedding planner coordinator',
  hotels: 'hotel wedding guest block',
  lighting: 'wedding lighting event production',
}

async function fetchGooglePlaces(
  query: string,
  city: string,
  state: string
): Promise<{ name: string; address: string; rating?: number; website?: string }[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.websiteUri',
    },
    body: JSON.stringify({ textQuery: `${query} in ${city}, ${state}`, maxResultCount: 10 }),
  })
  const data = await res.json()
  return (data.places ?? []).map((p: Record<string, unknown>) => ({
    name: (p.displayName as { text: string })?.text ?? '',
    address: (p.formattedAddress as string) ?? '',
    rating: p.rating as number | undefined,
    website: p.websiteUri as string | undefined,
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => null)
    if (!body?.couple_id || !body?.category) {
      return new Response(JSON.stringify({ error: 'couple_id and category are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { couple_id, category } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: couple } = await supabase
      .from('couples')
      .select('city, state, vibe_profile')
      .eq('id', couple_id)
      .single()

    if (!couple?.city) {
      return new Response(JSON.stringify({ error: 'Set your city in onboarding first' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const queryTerm = CATEGORY_QUERY[category] ?? `wedding ${category}`
    const places = await fetchGooglePlaces(queryTerm, couple.city, couple.state ?? '')

    if (places.length === 0) {
      return new Response(JSON.stringify({ vendors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vibeDesc = couple.vibe_profile
      ? `Aesthetic: ${couple.vibe_profile.aesthetic}, Formality: ${couple.vibe_profile.formality}, Setting: ${couple.vibe_profile.setting}, Vibe words: ${couple.vibe_profile.vibe_words?.join(', ')}, Music: ${couple.vibe_profile.music_style}, Priority: ${couple.vibe_profile.priority}`
      : 'No vibe profile set'

    const placesText = places.map((p, i) =>
      `${i + 1}. ${p.name} — ${p.address}${p.rating ? ` (${p.rating}/5)` : ''}${p.website ? ` — ${p.website}` : ''}`
    ).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a neutral wedding planning advisor. The couple's vibe: ${vibeDesc}.

They need a ${queryTerm} in ${couple.city}, ${couple.state}.

Here are vendors found via Google Places:
${placesText}

Select the 4-6 best fits for this couple's vibe. For each, give a one-sentence reason why they fit.

Respond in this exact JSON format:
{
  "vendors": [
    { "name": "Vendor Name", "address": "123 Main St", "website": "https://...", "reason": "One sentence about why this fits their vibe." }
  ]
}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')
    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = fenceMatch ? fenceMatch[1] : content.text
    const jsonMatch = jsonSource.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])

    await supabase.from('ai_insights').insert({
      couple_id,
      type: 'vendor_shortlist',
      content: `Shortlist for ${category}: ${(result.vendors ?? []).map((v: { name: string }) => v.name).join(', ')}`,
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
