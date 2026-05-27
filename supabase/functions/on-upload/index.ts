// Supabase Edge Function: triggered by storage insert on photos bucket
// Calls GPT-4o-mini Vision → generates tags → generates embedding → updates photos row
// TODO (Épico 3): implement full tagging pipeline
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req: Request) => {
  const body = await req.json()
  console.log('on-upload trigger received:', body)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
