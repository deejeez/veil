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
    if (!body?.vendor_id || !body?.file_path || !body?.document_type) {
      return new Response(
        JSON.stringify({ error: 'vendor_id, file_path, and document_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { vendor_id, file_path, document_type, category } = body

    // Auth
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

    // Get vendor and verify ownership
    const { data: vendor } = await supabase
      .from('vendors')
      .select('*, couples!inner(id, user_id_primary, user_id_partner)')
      .eq('id', vendor_id)
      .single()

    if (!vendor) {
      return new Response(JSON.stringify({ error: 'Vendor not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const couple = (vendor as Record<string, unknown>).couples as {
      id: string; user_id_primary: string; user_id_partner: string | null
    }
    if (couple.user_id_primary !== user.id && couple.user_id_partner !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download the file — try documents bucket first, fall back to contracts
    let fileBuffer: ArrayBuffer | null = null
    for (const bucket of ['documents', 'contracts']) {
      const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(file_path, 120)
      if (urlData?.signedUrl) {
        const res = await fetch(urlData.signedUrl)
        if (res.ok) {
          fileBuffer = await res.arrayBuffer()
          break
        }
      }
    }

    if (!fileBuffer) {
      return new Response(JSON.stringify({ error: 'Could not download file' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert to base64
    const bytes = new Uint8Array(fileBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const fileBase64 = btoa(binary)

    // Determine media type
    const ext = file_path.split('.').pop()?.toLowerCase() ?? ''
    const isImage = ['png', 'jpg', 'jpeg'].includes(ext)
    const mediaType = isImage
      ? (ext === 'png' ? 'image/png' : 'image/jpeg')
      : 'application/pdf'

    // Get existing line item labels from other vendors in the same category for normalization
    const { data: otherVendors } = await supabase
      .from('vendors')
      .select('id')
      .eq('couple_id', couple.id)
      .eq('category', category || vendor.category)
      .neq('id', vendor_id)

    let existingLabelsContext = ''
    if (otherVendors && otherVendors.length > 0) {
      const otherIds = otherVendors.map((v: { id: string }) => v.id)
      const { data: existingItems } = await supabase
        .from('vendor_line_items')
        .select('normalized_label')
        .in('vendor_id', otherIds)

      if (existingItems && existingItems.length > 0) {
        const uniqueLabels = [...new Set(existingItems.map((i: { normalized_label: string }) => i.normalized_label))]
        existingLabelsContext = `\n\nOther vendors in this category already have these normalized line item labels: ${JSON.stringify(uniqueLabels)}. When normalizing labels for the new line items, use these SAME normalized_label values where the service is equivalent. For example, if an existing vendor has "Table centerpieces" and this document mentions "reception floral arrangements for dining tables", use "Table centerpieces" as the normalized_label. Only create a new normalized_label if the service genuinely doesn't match any existing label.`
      }
    }

    const categoryLabel = category || vendor.category || 'vendor'

    // Build the AI message content
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [
      isImage
        ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg', data: fileBase64 } }
        : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } },
      {
        type: 'text' as const,
        text: `Analyze this ${categoryLabel} ${document_type} and extract the following:

PART 1 - Standard fields (return as JSON object called 'vendor_fields'):
- vendor_name: string or null
- contact_name: string or null
- contact_email: string or null
- contact_phone: string or null
- total_amount: number or null (the total cost/quote)
- deposit_amount: number or null
- deposit_due_date: string or null (YYYY-MM-DD if found)
- balance_amount: number or null
- balance_due_date: string or null (YYYY-MM-DD if found)
- cancellation_summary: string or null (one sentence summary of cancellation terms)
- key_terms: string[] (array of important terms or conditions, max 5)

PART 2 - Line items (return as JSON array called 'line_items'):
Extract every individual service, item, or cost component mentioned. For each:
- label: string (the description as written in the document)
- normalized_label: string (a short, standardized name for this type of service that would be consistent across different vendors in this category)
- amount: number or null (cost for this item)
- quantity: number or null (if a count is mentioned)
- unit: string or null (e.g., "tables", "hours", "guests", "pieces")
- notes: string or null (any relevant details like "includes setup" or "seasonal flowers only")
${existingLabelsContext}

Return ONLY valid JSON with no markdown formatting, no backticks, no preamble. The response should be a single JSON object with 'vendor_fields' and 'line_items' keys.`,
      },
    ]

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: 'You are an expert wedding vendor proposal and contract analyzer. Extract structured data from the uploaded document. Be precise with dollar amounts. If a field cannot be found in the document, return null for that field.',
      messages: [{ role: 'user', content }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse JSON — handle possible markdown fences
    const raw = textBlock.text
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonSource = (fenceMatch ? fenceMatch[1] : raw).trim()
    let result
    try {
      result = JSON.parse(jsonSource)
    } catch {
      const jsonMatch = jsonSource.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No valid JSON in AI response')
      result = JSON.parse(jsonMatch[0])
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('extract-proposal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
