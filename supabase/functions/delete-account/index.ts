import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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

    // Verify the user from their JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete all couple data with the service role (RLS has no delete policies
    // on these tables, and the FKs from couples/vendors don't cascade, so the
    // client can't do this itself and the auth delete would fail on the FK).
    const { data: couple } = await supabase
      .from('couples')
      .select('id')
      .or(`user_id_primary.eq.${user.id},user_id_partner.eq.${user.id}`)
      .maybeSingle()

    if (couple) {
      // Remove uploaded documents from storage
      const { data: contractRows } = await supabase
        .from('contracts')
        .select('file_path')
        .eq('couple_id', couple.id)
      const { data: vendorRows } = await supabase
        .from('vendors')
        .select('contract_url, proposal_url')
        .eq('couple_id', couple.id)
      const filePaths = [
        ...(contractRows ?? []).map(r => r.file_path),
        ...(vendorRows ?? []).flatMap(r => [r.contract_url, r.proposal_url]),
      ].filter((p): p is string => !!p)
      if (filePaths.length > 0) {
        await supabase.storage.from('documents').remove(filePaths)
      }

      // Delete rows in FK-safe order (tasks, guests, vendor_notes,
      // vendor_line_items, and vendor_categories cascade from couples/vendors)
      for (const table of ['ai_insights', 'contracts', 'payments', 'budget_categories', 'vendors', 'couples']) {
        const { error } = await supabase.from(table).delete().eq(table === 'couples' ? 'id' : 'couple_id', couple.id)
        if (error) throw new Error(`Failed deleting ${table}: ${error.message}`)
      }
    }

    // Delete the auth user (requires service role key)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
