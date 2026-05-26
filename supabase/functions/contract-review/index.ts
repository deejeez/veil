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

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: contract } = await supabase
      .from('contracts')
      .select('*, vendors(category, booked_amount)')
      .eq('id', contract_id)
      .single()

    if (!contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const { data: urlData } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, 60)

    if (!urlData?.signedUrl) throw new Error('Could not get signed URL')

    const pdfRes = await fetch(urlData.signedUrl)
    const pdfBuffer = await pdfRes.arrayBuffer()
    const bytes = new Uint8Array(pdfBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const pdfBase64 = btoa(binary)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `This is a wedding vendor contract for ${contract.vendors?.category ?? 'a vendor'}.${contract.vendors?.booked_amount ? ` The booked amount is $${contract.vendors.booked_amount}.` : ''}

Review this contract for key clauses a couple needs to understand before signing. Focus on:
1. Cancellation policy
2. Overtime charges
3. Exclusivity clauses
4. Deposit forfeiture conditions
5. Force majeure / rescheduling terms

Respond in this exact JSON format:
{
  "summary": "2-3 sentence plain English summary of the most important things to know",
  "flags": [
    {
      "clause": "Cancellation Policy",
      "severity": "flag",
      "text": "Plain English explanation of what this says and what it means for the couple."
    }
  ]
}

Severity: "flag" = needs attention before signing, "caution" = worth understanding, "info" = standard/neutral.
Only include flags for clauses actually present in the contract.`,
          },
        ],
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response')

    const fenceMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = (fenceMatch ? fenceMatch[1] : content.text).trim()
    let review
    try {
      review = JSON.parse(jsonSource)
    } catch {
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      review = JSON.parse(jsonMatch[0])
    }

    const aiReview = {
      status: 'complete',
      flags: review.flags ?? [],
      summary: review.summary ?? '',
      reviewed_at: new Date().toISOString(),
    }

    await supabase.from('contracts').update({ ai_review: aiReview }).eq('id', contract_id)

    return new Response(JSON.stringify(aiReview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
