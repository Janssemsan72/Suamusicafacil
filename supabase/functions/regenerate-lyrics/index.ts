import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ✅ CORREÇÃO: CORS headers que permitem localhost para desenvolvimento
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permitir todas as origens (incluindo localhost)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Regenerate Lyrics Started ===');
    
    // ✅ DIAGNÓSTICO: Verificar variáveis de ambiente
    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    
    console.log('🔍 [RegenerateLyrics] Variáveis de ambiente:', {
      hasSupabaseUrl: !!supabaseUrlEnv,
      hasServiceKey: !!serviceKeyEnv,
      supabaseUrlLength: supabaseUrlEnv.length,
      serviceKeyLength: serviceKeyEnv.length
    });
    
    if (!supabaseUrlEnv || !serviceKeyEnv) {
      console.error('❌ [RegenerateLyrics] Variáveis de ambiente não configuradas:', {
        SUPABASE_URL: !!supabaseUrlEnv,
        SERVICE_ROLE_KEY: !!serviceKeyEnv
      });
      // ✅ Retornar 200 com payload de erro evita "Edge Function returned a non-2xx"
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Configuração do Supabase ausente. Verifique SUPABASE_URL/PROJECT_URL e SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY nas secrets da Function.',
        }),
        { headers: corsHeaders, status: 200 }
      );
    }
    
    const supabase = createClient(supabaseUrlEnv, serviceKeyEnv);

    // ✅ CORREÇÃO: Parsing resiliente do body - ler apenas uma vez
    let approval_id: string | null = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      console.log('📥 [RegenerateLyrics] Content-Type:', contentType);
      
      // Tentar ler o body apenas uma vez
      let body: any = null;
      try {
        if (contentType.includes('application/json')) {
          body = await req.json();
          console.log('📦 [RegenerateLyrics] Body JSON:', body);
        } else {
          const raw = await req.text();
          console.log('📦 [RegenerateLyrics] Body raw:', raw);
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch (parseErr) {
              console.warn('⚠️ [RegenerateLyrics] Não foi possível fazer parse do body como JSON');
            }
          }
        }
      } catch (readError) {
        console.error('❌ [RegenerateLyrics] Erro ao ler body:', readError);
      }
      
      // Extrair approval_id do body ou query string
      if (body && body.approval_id) {
        approval_id = body.approval_id;
      } else {
        // Tentar query string como fallback
        try {
          const url = new URL(req.url);
          approval_id = url.searchParams.get('approval_id');
        } catch (urlError) {
          console.error('❌ [RegenerateLyrics] Erro ao parsear URL:', urlError);
        }
      }
      
      console.log('🔍 [RegenerateLyrics] approval_id extraído:', approval_id);
    } catch (parseError) {
      console.error('❌ [RegenerateLyrics] Erro ao fazer parse do body:', parseError);
      // Tentar query string como último recurso
      try {
        const url = new URL(req.url);
        approval_id = url.searchParams.get('approval_id');
        console.log('🔍 [RegenerateLyrics] approval_id da query string:', approval_id);
      } catch (urlError) {
        console.error('❌ [RegenerateLyrics] Erro ao parsear URL:', urlError);
      }
    }

    if (!approval_id) {
      console.error('❌ [RegenerateLyrics] approval_id não fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'approval_id é obrigatório' }), 
        { headers: corsHeaders, status: 200 }
      );
    }

    console.log('📝 Regenerando letras para approval_id:', approval_id);

    // ✅ CORREÇÃO: Buscar aprovação com mais informações
    const { data: approval, error: fetchErr } = await supabase
      .from('lyrics_approvals')
      .select('id, job_id, status, regeneration_count')
      .eq('id', approval_id)
      .single();

    if (fetchErr || !approval) {
      console.error('❌ [RegenerateLyrics] Erro ao buscar aprovação:', fetchErr);
      throw new Error(fetchErr?.message || 'Aprovação não encontrada');
    }

    if (!approval.job_id) {
      console.error('❌ [RegenerateLyrics] Job não encontrado para aprovação:', approval_id);
      throw new Error('Job não encontrado para esta aprovação');
    }

    console.log('📋 Aprovação encontrada:', {
      id: approval.id,
      job_id: approval.job_id,
      status: approval.status,
      regeneration_count: approval.regeneration_count
    });

    // ✅ CORREÇÃO: Limpar letras antigas do job antes de regenerar
    console.log('🧹 Limpando letras antigas do job...');
    const { error: clearError } = await supabase
      .from('jobs')
      .update({ 
        gpt_lyrics: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', approval.job_id);

    if (clearError) {
      console.warn('⚠️ [RegenerateLyrics] Erro ao limpar letras antigas (não crítico):', clearError);
    } else {
      console.log('✅ Letras antigas limpas do job');
    }

    // ✅ CORREÇÃO: Atualizar status da aprovação para 'pending' antes de regenerar
    console.log('🔄 Atualizando status da aprovação para pending...');
    const { error: updateError } = await supabase
      .from('lyrics_approvals')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', approval_id);

    if (updateError) {
      console.warn('⚠️ [RegenerateLyrics] Erro ao atualizar status (não crítico):', updateError);
    } else {
      console.log('✅ Status da aprovação atualizado para pending');
    }

    // ✅ CORREÇÃO: Chamar a função interna para regenerar a letra com o mesmo job
    // Usar chamada HTTP direta com autenticação correta (mesmo padrão de generate-lyrics-for-approval)
    console.log('🚀 Chamando generate-lyrics-internal com job_id:', approval.job_id);
    
    // Reutilizar variáveis já verificadas no início
    const supabaseUrl = supabaseUrlEnv;
    const serviceKey = serviceKeyEnv;
    
    const functionUrl = `${supabaseUrl}/functions/v1/generate-lyrics-internal`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ job_id: approval.job_id })
    });
    
    let data: any = null;
    let error: any = null;
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (_) {
        // Se não for JSON, usar o texto como mensagem
      }
      
      error = {
        name: 'FunctionsHttpError',
        message: errorJson?.error || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        context: response
      };
      
      console.error('❌ [RegenerateLyrics] Erro HTTP ao chamar generate-lyrics-internal:', {
        status: response.status,
        statusText: response.statusText,
        error: errorJson || errorText
      });
    } else {
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('❌ [RegenerateLyrics] Erro ao fazer parse da resposta:', parseErr);
        error = {
          name: 'ParseError',
          message: 'Resposta inválida da função',
          status: response.status
        };
      }
    }

    if (error) {
      console.error('❌ [RegenerateLyrics] Erro ao chamar generate-lyrics-internal:', error);
      throw error;
    }

    // ✅ Se generate-lyrics-internal retornar success=false em HTTP 200, tratar como erro
    if (data?.success === false || data?.error) {
      const msg = data?.error || 'Falha ao regenerar letra';
      console.error('❌ [RegenerateLyrics] generate-lyrics-internal retornou falha:', { msg, data });
      throw new Error(msg);
    }

    console.log('✅ [RegenerateLyrics] Regeneração concluída com sucesso');
    return new Response(
      JSON.stringify({ 
        success: true, 
        approval_id, 
        data,
        approval: data?.approval // Incluir dados da aprovação atualizada
      }), 
      { headers: corsHeaders, status: 200 }
    );
  } catch (e: any) {
    console.error('❌ [RegenerateLyrics] Erro geral:', e);
    console.error('❌ [RegenerateLyrics] Stack:', e?.stack);
    console.error('❌ [RegenerateLyrics] Detalhes:', JSON.stringify(e, null, 2));
    
    // ✅ Mantemos o status informativo no body, mas retornamos 200 para não quebrar o invoke
    const statusCode = e?.status || 500;
    
    // Extrair mensagem de erro de forma mais robusta
    let errorMessage = 'Erro desconhecido ao regenerar letra';
    
    if (e?.message) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    } else if (e?.error) {
      errorMessage = typeof e.error === 'string' ? e.error : e.error?.message || JSON.stringify(e.error);
    } else {
      try {
        errorMessage = JSON.stringify(e);
      } catch {
        errorMessage = String(e);
      }
    }
    
    // Verificar se é erro relacionado à API Key
    if (errorMessage.includes('ANTHROPIC_API_KEY') || errorMessage.includes('Anthropic')) {
      errorMessage = 'ANTHROPIC_API_KEY não configurada. Configure em Settings > Functions no Supabase Dashboard.';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: e?.details || null,
        status: statusCode
      }), 
      { headers: corsHeaders, status: 200 }
    );
  }
});
