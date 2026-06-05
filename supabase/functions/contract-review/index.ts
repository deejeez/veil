import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => null)
    if (!body?.contract_id) {
      return new Response(JSON.stringify({ error: 'contract_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { contract_id } = body

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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get contract record
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*, vendors(category, booked_amount)')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: `Contract not found: ${contractError?.message ?? 'no data'}` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify ownership
    const { data: couple } = await supabase
      .from('couples')
      .select('user_id_primary, user_id_partner')
      .eq('id', contract.couple_id)
      .single()

    if (couple?.user_id_primary !== user.id && couple?.user_id_partner !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download PDF from storage
    const { data: urlData, error: urlError } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, 120)

    if (urlError || !urlData?.signedUrl) {
      return new Response(JSON.stringify({ error: `Could not get signed URL: ${urlError?.message ?? 'no URL returned'}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfRes = await fetch(urlData.signedUrl)
    if (!pdfRes.ok) {
      return new Response(JSON.stringify({ error: `Failed to download PDF: ${pdfRes.status} ${pdfRes.statusText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfBuffer = await pdfRes.arrayBuffer()
    const bytes = new Uint8Array(pdfBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const pdfBase64 = btoa(binary)

    // Call Claude with document
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `This is a wedding vendor contract for ${contract.vendors?.category ?? 'a vendor'}.${contract.vendors?.booked_amount ? ` The booked amount is $${contract.vendors.booked_amount.toLocaleString()}.` : ''}

Analyze this contract thoroughly for a couple planning their wedding. They are not lawyers — explain everything in plain English like a smart friend who happens to know contracts.

Respond in this exact JSON format (no markdown fences, just raw JSON):

{
  "summary": "2-3 sentence plain-English overview. What kind of contract is this? What are the key financial terms? Is anything unusual? Write like you're explaining to a friend over coffee.",
  "flags": [
    {
      "clause": "Category name (e.g. Cancellation Policy, Overtime Fees, Payment Schedule)",
      "severity": "flag | caution | info",
      "text": "Plain English explanation of what this clause says and what it means for the couple. Be specific — quote dollar amounts, percentages, and deadlines from the contract."
    }
  ],
  "dates_money": [
    {
      "label": "Short label (e.g. Deposit, Final Payment, Changes Deadline)",
      "detail": "Specific amount and/or date (e.g. '$5,419.93 due May 20, 2026' or '4 weeks before event')"
    }
  ],
  "questions": [
    "A specific question the couple should ask the vendor about this contract, based on ambiguities or terms worth clarifying."
  ]
}

Guidelines:
- "flag" severity = unusual, potentially unfavorable, or needs discussion before signing
- "caution" severity = worth understanding, standard but important
- "info" severity = standard/favorable terms, no action needed
- Include ALL relevant clauses, not just problems. Good terms deserve "info" flags too.
- Extract every date and dollar amount into dates_money.
- Generate 2-4 specific questions based on what's ambiguous or worth asking about.
- Only include information actually present in the contract.`,
          },
        ],
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

    // Parse JSON from response (handle optional markdown fences)
    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = (fenceMatch ? fenceMatch[1] : content.text).trim()
    let review
    try {
      review = JSON.parse(jsonSource)
    } catch {
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No valid JSON in Claude response')
      review = JSON.parse(jsonMatch[0])
    }

    const aiReview = {
      status: 'complete',
      flags: review.flags ?? [],
      summary: review.summary ?? '',
      dates_money: review.dates_money ?? [],
      questions: review.questions ?? [],
      reviewed_at: new Date().toISOString(),
    }

    // Cache in database
    await supabase.from('contracts').update({ ai_review: aiReview }).eq('id', contract_id)

    return new Response(JSON.stringify(aiReview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('contract-review error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
