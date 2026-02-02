import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const secureHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapear país para região comercial
function mapCountryToRegion(country: string): string {
  const regionMap: Record<string, string> = {
    // Brasil
    'BR': 'brasil',
    
    // USA e países de língua inglesa
    'US': 'usa',
    'GB': 'usa', // Reino Unido -> USA (preço USD)
    'CA': 'usa', // Canadá -> USA (preço USD)
    'AU': 'usa', // Austrália -> USA (preço USD)
    'NZ': 'usa', // Nova Zelândia -> USA (preço USD)
    
    // Países de língua espanhola -> internacional
    'ES': 'internacional',
    'MX': 'internacional',
    'AR': 'internacional',
    'CO': 'internacional',
    'CL': 'internacional',
    'PE': 'internacional',
    'VE': 'internacional',
    'EC': 'internacional',
    'GT': 'internacional',
    'CU': 'internacional',
    'BO': 'internacional',
    'DO': 'internacional',
    'HN': 'internacional',
    'PY': 'internacional',
    'SV': 'internacional',
    'NI': 'internacional',
    'CR': 'internacional',
    'PA': 'internacional',
    'UY': 'internacional',
    'GQ': 'internacional',
  };
  
  return regionMap[country] || 'internacional'; // Padrão: internacional
}

// Mapear país para idioma
function mapCountryToLanguage(country: string): string {
  const languageMap: Record<string, string> = {
    // Português
    'BR': 'pt',
    'PT': 'pt',
    'AO': 'pt',
    'MZ': 'pt',
    'CV': 'pt',
    'GW': 'pt',
    'ST': 'pt',
    'TL': 'pt',
    
    // Inglês
    'US': 'en',
    'GB': 'en',
    'CA': 'en',
    'AU': 'en',
    'NZ': 'en',
    'IE': 'en',
    'SG': 'en',
    'MY': 'en',
    'PH': 'en',
    'IN': 'en',
    'PK': 'en',
    'BD': 'en',
    'LK': 'en',
    'MM': 'en',
    'FJ': 'en',
    'PG': 'en',
    'SB': 'en',
    'VU': 'en',
    'TO': 'en',
    'WS': 'en',
    'KI': 'en',
    'TV': 'en',
    'NR': 'en',
    'PW': 'en',
    'FM': 'en',
    'MH': 'en',
    'CK': 'en',
    'NU': 'en',
    'TK': 'en',
    'NF': 'en',
    
    // Espanhol (padrão)
    'ES': 'es',
    'MX': 'es',
    'AR': 'es',
    'CO': 'es',
    'CL': 'es',
    'PE': 'es',
    'VE': 'es',
    'EC': 'es',
    'GT': 'es',
    'CU': 'es',
    'BO': 'es',
    'DO': 'es',
    'HN': 'es',
    'PY': 'es',
    'SV': 'es',
    'NI': 'es',
    'CR': 'es',
    'PA': 'es',
    'UY': 'es',
    'GQ': 'es',
  };
  
  return languageMap[country] || 'es'; // Padrão: espanhol
}

// Detectar país via IP
async function detectCountryByIP(ip: string): Promise<string> {
  try {
    // Tentar ipapi.co primeiro
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    
    if (response.ok) {
      const data = await response.json();
      return data.country_code || 'OTHER';
    }
  } catch (error) {
    console.warn('⚠️ ipapi.co falhou, tentando fallback:', error);
  }

  try {
    // Fallback: ip-api.com
    const fallbackResponse = await fetch(`http://ip-api.com/json/${ip}`);
    
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      return fallbackData.countryCode || 'OTHER';
    }
  } catch (error) {
    console.warn('⚠️ Fallback também falhou:', error);
  }

  // Último fallback
  return 'OTHER';
}

// Hash do IP para privacidade
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'musiclovely_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const headers = secureHeaders;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  console.log("=== GET REGIONAL PRICING ===");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("❌ Supabase credentials not configured");
    return new Response(
      JSON.stringify({ error: "Supabase not configured" }),
      { status: 500, headers: { ...secureHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Extrair IP real do usuário
    const ip = req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-forwarded-for')?.split(',')[0]
      || req.headers.get('x-real-ip')
      || '8.8.8.8'; // Fallback para testes

    console.log('🌍 Detectando país para IP:', ip);

    // Buscar session_token do body
    const { session_token } = await req.json().catch(() => ({}));
    
    let session;
    
    if (session_token) {
      // Buscar sessão existente
      console.log('🔍 Buscando sessão existente:', session_token);
      const { data: existingSession, error: sessionError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', session_token)
        .single();
      
      if (sessionError) {
        console.warn('⚠️ Erro ao buscar sessão:', sessionError);
      } else if (existingSession && existingSession.expires_at > new Date().toISOString()) {
        session = existingSession;
        console.log('✅ Sessão encontrada:', session.detected_country, '->', session.detected_region);
      }
    }
    
    if (!session) {
      // Criar nova sessão
      console.log('🆕 Criando nova sessão...');
      const country = await detectCountryByIP(ip);
      const region = mapCountryToRegion(country);
      const language = mapCountryToLanguage(country);
      const ipHash = await hashIP(ip);
      
      const newSession = {
        ip_address_hash: ipHash,
        detected_country: country,
        detected_region: region,
        session_token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
      };
      
      const { data: insertedSession, error: insertError } = await supabase
        .from('user_sessions')
        .insert(newSession)
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Erro ao criar sessão:', insertError);
        throw insertError;
      }
      
      session = insertedSession;
      console.log('✅ Nova sessão criada:', country, '->', region);
    }
    
    // Buscar preços da região
    console.log('💰 Buscando preços para região:', session.detected_region);
    const { data: pricing, error: pricingError } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('region', session.detected_region)
      .eq('is_active', true)
      .order('created_at');
    
    if (pricingError) {
      console.error('❌ Erro ao buscar preços:', pricingError);
      throw pricingError;
    }
    
    console.log(`✅ Encontrados ${pricing.length} planos para região ${session.detected_region}`);
    
    return new Response(JSON.stringify({
      success: true,
      region: session.detected_region,
      country: session.detected_country,
      language: mapCountryToLanguage(session.detected_country),
      pricing: pricing,
      session_token: session.session_token,
      expires_at: session.expires_at
    }), {
      status: 200,
      headers: { ...secureHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('❌ Erro no get-regional-pricing:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        details: error.toString()
      }),
      { status: 500, headers: { ...secureHeaders, "Content-Type": "application/json" } }
    );
  }
});
