import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecureHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    console.log('🧪 Testando conexão Suno...');

    const sunoApiKey = Deno.env.get('SUNO_API_KEY');
    
    if (!sunoApiKey) {
      console.error('❌ SUNO_API_KEY não configurada');
      return new Response(JSON.stringify({ 
        configured: false,
        valid: false,
        error: 'SUNO_API_KEY não configurada no Supabase'
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔑 Validando SUNO_API_KEY (SEM gastar créditos)...');
    console.log('🔑 Primeiros caracteres da key:', sunoApiKey.substring(0, 10) + '...');

    // Usar endpoint de créditos para validar API Key sem gastar créditos
    console.log('📋 Buscando créditos da API Suno (sunoapi.org)...');
    const testResponse = await fetch('https://api.sunoapi.org/api/v1/gateway/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sunoApiKey}`,
        'Content-Type': 'application/json',
      },
      // Adicionar timeout para evitar travamentos
      signal: AbortSignal.timeout(10000), // 10 segundos timeout
    });

    const responseText = await testResponse.text();
    console.log('📡 Status da resposta:', testResponse.status);
    console.log('📄 Corpo da resposta (primeiros 500 chars):', responseText.substring(0, 500));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Erro ao parsear resposta JSON');
      throw new Error('Resposta inválida da API Suno');
    }

    // Tratar erros de autenticação primeiro
    if (testResponse.status === 401) {
      console.error('❌ API Key inválida (401)');
      return new Response(JSON.stringify({
        configured: true,
        valid: false,
        error: 'API Key inválida. Verifique a SUNO_API_KEY no Supabase.'
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se chegou aqui com 200, API Key é válida
    if (testResponse.ok) {
      const creditsRemaining = responseData.credits_remaining || responseData.credits || 0;
      const creditsUsed = responseData.credits_used || 0;
      const totalCredits = responseData.total_credits || creditsRemaining + creditsUsed;

      console.log('✅ API Key válida - Créditos:', {
        remaining: creditsRemaining,
        used: creditsUsed,
        total: totalCredits
      });

      // Verificar se tem créditos
      if (creditsRemaining <= 0) {
        console.warn('⚠️ Sem créditos disponíveis');
        return new Response(JSON.stringify({
          configured: true,
          valid: true,
          warning: 'API Key válida, mas sem créditos disponíveis. Adicione créditos em sunoapi.org',
          credits: creditsRemaining,
          creditsUsed: creditsUsed,
          totalCredits: totalCredits
        }), {
          status: 200,
          headers: { ...secureHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Tudo OK
      return new Response(JSON.stringify({
        configured: true,
        valid: true,
        message: 'Conexão Suno OK',
        credits: creditsRemaining,
        creditsUsed: creditsUsed,
        totalCredits: totalCredits
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    if (testResponse.status === 429) {
      console.error('⚠️ Rate limit atingido');
      return new Response(JSON.stringify({
        configured: true,
        valid: true,
        warning: 'API Key válida, mas rate limit atingido. Aguarde alguns minutos.'
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Outros erros
    console.error('⚠️ Resposta inesperada:', testResponse.status, responseText);
    
    return new Response(JSON.stringify({
      configured: true,
      valid: false,
      error: `Erro ${testResponse.status}: ${responseData?.detail || responseData?.msg || responseText.substring(0, 100)}`
    }), {
      status: 200,
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erro ao testar conexão Suno:', error);
    return new Response(JSON.stringify({ 
      configured: false,
      valid: false,
      error: error.message 
    }), {
      status: 200,
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
  }
});