import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36?target=deno'
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
    if (!body?.couple_id || !body?.vendor_name) {
      return new Response(JSON.stringify({ message: 'couple_id and vendor_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { couple_id, vendor_name, location, website } = body

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
      .select('user_id_primary, user_id_partner')
      .eq('id', couple_id)
      .single()

    if (couple?.user_id_primary !== user.id && couple?.user_id_partner !== user.id) {
      return new Response(JSON.stringify({ message: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      // deno-lint-ignore no-explicit-any
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }] as any,
      messages: [{
        role: 'user',
        content: `Research customer reviews for "${vendor_name}"${location ? `, a wedding vendor in ${location}` : ''}${website ? ` (website: ${website})` : ''}.

Use web search (1-2 quick searches) to find their ratings and reviews on platforms like Google, Yelp, The Knot, or WeddingWire.

Respond with ONLY valid JSON in this exact format, no markdown, no citations inside the JSON:
{
  "ratings": [
    { "platform": "Google", "rating": 4.8, "review_count": 120, "url": "https://link-to-reviews-or-empty-string" }
  ],
  "review_summary": "2-3 sentences summarizing what couples consistently say about this vendor",
  "review_highlight": "One short standout point of praise or a common criticism, paraphrased"
}

If you cannot find any reviews or ratings for this vendor, respond with:
{ "ratings": [], "review_summary": null, "review_highlight": null }`,
      }],
    })

    // Web search responses contain multiple content blocks (search calls,
    // results, text with citations). Find the JSON in the text blocks —
    // scan from the last block backwards, then fall back to joined text.
    const textBlocks = message.content.filter((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string }[]
    if (textBlocks.length === 0) throw new Error('Unexpected response type from AI')

    const tryParse = (source: string): { ratings?: unknown[] } | null => {
      const trimmed = source.trim()
      const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonSource = fenceMatch ? fenceMatch[1].trim() : trimmed
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed && Array.isArray(parsed.ratings) ? parsed : null
      } catch {
        return null
      }
    }

    let result: { ratings?: unknown[] } | null = null
    for (let bi = textBlocks.length - 1; bi >= 0 && !result; bi--) {
      result = tryParse(textBlocks[bi].text)
    }
    // Citations can split the final answer across multiple text blocks
    if (!result) result = tryParse(textBlocks.map(b => b.text).join(''))
    if (!result) throw new Error('AI response was not valid JSON')

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('vendor-reviews error:', err)
    return new Response(JSON.stringify({ message: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
