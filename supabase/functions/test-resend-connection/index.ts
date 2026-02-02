import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecureHeaders } from "../_shared/security-headers.ts";



serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    console.log('🔑 Testing Resend connection...');

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ 
        connected: false,
        valid: false,
        error: 'RESEND_API_KEY not configured in Supabase'
      }), {
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('✅ RESEND_API_KEY found');

    // Test connection by getting domain info
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status} ${response.statusText}`);
    }

    const domains = await response.json();
    console.log('✅ Successfully connected to Resend');
    console.log('Domains:', domains);

    // Get recent emails for metrics
    const emailsResponse = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    let metrics = {
      emailsSent24h: 0,
      deliveryRate: 100
    };

    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json();
      const emails = emailsData.data || [];
      const last24h = emails.filter((email: any) => {
        const emailDate = new Date(email.created_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return emailDate > dayAgo;
      });
      
      metrics.emailsSent24h = last24h.length;
      const delivered = last24h.filter((e: any) => e.last_event === 'delivered').length;
      metrics.deliveryRate = last24h.length > 0 
        ? Math.round((delivered / last24h.length) * 100) 
        : 100;
    }

    return new Response(JSON.stringify({
      connected: true,
      valid: true,
      domains: domains.data || [],
      metrics
    }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Resend connection error:', error);
    return new Response(JSON.stringify({
      connected: false,
      valid: false,
      error: error.message
    }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
