import Stripe from 'npm:stripe@17'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  // @ts-ignore — Stripe requires fetch-based HTTP client in Deno
  httpClient: Stripe.createFetchHttpClient(),
})
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(String(err), { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id

    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      await supabase
        .from('couples')
        .update({ paid: true, stripe_session_id: session.id })
        .eq('user_id_primary', userId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
