import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔑 Getting Suno credits...');

    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    
    if (!sunoApiKey) {
      console.error('❌ SUNO_API_KEY not configured');
      return new Response(JSON.stringify({ 
        connected: false,
        error: 'SUNO_API_KEY not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Try to get credits info
    const response = await fetch('https://api.sunoaiapi.com/api/v1/gateway/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sunoApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Suno API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Successfully retrieved Suno credits');

    return new Response(JSON.stringify({
      connected: true,
      credits: data.credits || data.total_credits || 0,
      creditsUsed: data.credits_used || 0,
      creditsRemaining: data.credits_remaining || data.credits || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Suno credits error:', error);
    return new Response(JSON.stringify({
      connected: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
