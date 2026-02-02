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
    console.log('=== Delete Lyrics Approval Started ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    let approval_id: string | null = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        approval_id = (body && body.approval_id) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            approval_id = parsed.approval_id || null;
          } catch (_) {
            const url = new URL(req.url);
            approval_id = url.searchParams.get('approval_id');
          }
        } else {
          const url = new URL(req.url);
          approval_id = url.searchParams.get('approval_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [DeleteLyricsApproval] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        approval_id = url.searchParams.get('approval_id');
      } catch (_) {
        // Ignorar
      }
    }

    if (!approval_id) {
      console.error('❌ [DeleteLyricsApproval] approval_id não fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'approval_id é obrigatório' }), 
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log('🗑️ Deletando aprovação de letras:', approval_id);

    // Buscar aprovação para obter job_id/order_id
    const { data: approval, error: fetchErr } = await supabase
      .from('lyrics_approvals')
      .select('id, job_id, order_id')
      .eq('id', approval_id)
      .maybeSingle();

    if (fetchErr) {
      console.error('❌ [DeleteLyricsApproval] Erro ao buscar aprovação:', fetchErr);
      throw fetchErr;
    }

    if (!approval) {
      console.warn('⚠️ [DeleteLyricsApproval] Aprovação não encontrada:', approval_id);
      // Se não existe, retornar sucesso (idempotente)
      return new Response(
        JSON.stringify({ success: true, message: 'Aprovação não encontrada (já foi deletada?)', approval_id }),
        { headers: corsHeaders, status: 200 }
      );
    }

    // Remover logs relacionados à aprovação (não crítico se falhar)
    try {
      await supabase
        .from('admin_logs')
        .delete()
        .or(
          [
            "target_table.eq.lyrics_approvals,target_id.eq." + approval_id,
            "changes->>approval_id.eq." + approval_id
          ].join(',')
        );
      console.log('✅ [DeleteLyricsApproval] Logs removidos');
    } catch (logError) {
      console.warn('⚠️ [DeleteLyricsApproval] Erro ao remover logs (não crítico):', logError);
    }

    // Apagar job vinculado (se existir, não crítico se falhar)
    if (approval.job_id) {
      try {
        const { error: jobDelErr } = await supabase.from('jobs').delete().eq('id', approval.job_id);
        if (jobDelErr) {
          console.warn('⚠️ [DeleteLyricsApproval] Erro ao deletar job (não crítico):', jobDelErr);
        } else {
          console.log('✅ [DeleteLyricsApproval] Job deletado');
        }
      } catch (jobError) {
        console.warn('⚠️ [DeleteLyricsApproval] Erro ao deletar job (não crítico):', jobError);
      }
    }

    // Apagar aprovação
    const { error: delErr } = await supabase
      .from('lyrics_approvals')
      .delete()
      .eq('id', approval_id);

    if (delErr) {
      console.error('❌ [DeleteLyricsApproval] Erro ao deletar aprovação:', delErr);
      throw delErr;
    }

    console.log('✅ [DeleteLyricsApproval] Aprovação deletada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Aprovação deletada com sucesso',
        approval_id 
      }), 
      { 
        headers: corsHeaders, 
        status: 200 
      }
    );
  } catch (e: any) {
    console.error('❌ [DeleteLyricsApproval] Erro geral:', e);
    // ✅ CORREÇÃO: Retornar status HTTP correto em caso de erro
    const statusCode = e?.status || 500;
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: e?.message || String(e) 
      }), 
      { 
        headers: corsHeaders, 
        status: statusCode 
      }
    );
  }
});
