import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  // ✅ CORREÇÃO: Responder OPTIONS imediatamente sem processamento
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Admin Reject Lyrics Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    let approval_id: string | null = null;
    let reason: string | null = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        approval_id = (body && body.approval_id) || null;
        reason = (body && body.reason) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            approval_id = parsed.approval_id || null;
            reason = parsed.reason || null;
          } catch (_) {
            const url = new URL(req.url);
            approval_id = url.searchParams.get('approval_id');
            reason = url.searchParams.get('reason');
          }
        } else {
          const url = new URL(req.url);
          approval_id = url.searchParams.get('approval_id');
          reason = url.searchParams.get('reason');
        }
      }
    } catch (parseError) {
      console.error('❌ [AdminRejectLyrics] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        approval_id = url.searchParams.get('approval_id');
        reason = url.searchParams.get('reason');
      } catch (_) {
        // Ignorar
      }
    }

    if (!approval_id) {
      console.error('❌ [AdminRejectLyrics] approval_id não fornecido');
      return new Response(
        JSON.stringify({ error: 'approval_id é obrigatório' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log('📋 Rejeitando letra:', approval_id, 'Motivo:', reason);

    // 1. Buscar aprovação
    const { data: approval, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approval) {
      console.error('❌ [AdminRejectLyrics] Erro ao buscar aprovação:', approvalError);
      throw new Error(`Aprovação não encontrada: ${approvalError?.message}`);
    }

    if (approval.status !== 'pending') {
      console.warn('⚠️ [AdminRejectLyrics] Aprovação já foi processada:', approval.status);
      throw new Error(`Aprovação já foi ${approval.status}`);
    }

    // 2. Atualizar aprovação para rejected
    const { error: updateError } = await supabaseClient
      .from('lyrics_approvals')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'Rejeitado pelo administrador',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', approval_id);

    if (updateError) {
      console.error('❌ [AdminRejectLyrics] Erro ao atualizar aprovação:', updateError);
      throw new Error(`Erro ao rejeitar: ${updateError.message}`);
    }

    // 3. Atualizar job para failed (não crítico se falhar)
    if (approval.job_id) {
      const { error: jobError } = await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          error: `Letra rejeitada: ${reason || 'Rejeitado pelo administrador'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.job_id);

      if (jobError) {
        console.warn('⚠️ [AdminRejectLyrics] Erro ao atualizar job (não crítico):', jobError);
      } else {
        console.log('✅ [AdminRejectLyrics] Job atualizado para failed');
      }
    }

    // 4. Log da ação (não crítico se falhar)
    try {
      await supabaseClient.from('admin_logs').insert({
        action: 'lyrics_rejected',
        target_table: 'lyrics_approvals',
        target_id: approval_id,
        details: {
          approval_id: approval_id,
          job_id: approval.job_id,
          order_id: approval.order_id,
          reason: reason
        }
      });
    } catch (logError) {
      console.warn('⚠️ [AdminRejectLyrics] Erro ao registrar log (não crítico):', logError);
    }

    console.log('✅ [AdminRejectLyrics] Letra rejeitada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Letra rejeitada com sucesso',
        approval_id: approval_id
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ [AdminRejectLyrics] Erro geral:', error);
    // ✅ CORREÇÃO: Retornar status HTTP correto em caso de erro
    const statusCode = error?.status || 500;
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro desconhecido ao rejeitar letra' 
      }),
      {
        headers: corsHeaders,
        status: statusCode,
      }
    );
  }
});
