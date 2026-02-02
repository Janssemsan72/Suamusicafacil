import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Regenerate All Pending Lyrics Started ===');
    
    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrlEnv || !serviceKeyEnv) {
      throw new Error('Configuração do Supabase não encontrada. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    }
    
    const supabase = createClient(supabaseUrlEnv, serviceKeyEnv);

    // Buscar todas as aprovações pendentes (sem limite, usando paginação)
    console.log('📋 Buscando todas as letras pendentes...');
    let allApprovals: any[] = [];
    let page = 0;
    const pageSize = 1000; // Tamanho máximo por página do Supabase
    let hasMore = true;

    while (hasMore) {
      const { data: approvals, error: approvalsError } = await supabase
        .from('lyrics_approvals')
        .select('id, job_id, status, order_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (approvalsError) {
        console.error('❌ Erro ao buscar approvals:', approvalsError);
        throw new Error(`Erro ao buscar aprovações: ${approvalsError.message}`);
      }

      if (approvals && approvals.length > 0) {
        allApprovals = allApprovals.concat(approvals);
        console.log(`📄 Página ${page + 1}: ${approvals.length} letras encontradas (Total acumulado: ${allApprovals.length})`);
        
        // Se retornou menos que o pageSize, não há mais páginas
        if (approvals.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const approvals = allApprovals;

    if (!approvals || approvals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma letra pendente encontrada',
          total: 0,
          processed: 0,
          errors: []
        }), 
        { headers: corsHeaders, status: 200 }
      );
    }

    console.log(`✅ Encontradas ${approvals.length} letras pendentes`);

    const results = {
      total: approvals.length,
      success: 0,
      errors: [] as Array<{ approval_id: string; error: string }>
    };

    // Regenerar cada letra
    for (let i = 0; i < approvals.length; i++) {
      const approval = approvals[i];
      const progress = `[${i + 1}/${approvals.length}]`;
      
      console.log(`${progress} Regenerando approval_id: ${approval.id}...`);

      try {
        if (!approval.job_id) {
          throw new Error('Job não encontrado para esta aprovação');
        }

        // Limpar letras antigas do job
        await supabase
          .from('jobs')
          .update({ 
            gpt_lyrics: null,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.job_id);

        // Atualizar status da aprovação para 'pending'
        await supabase
          .from('lyrics_approvals')
          .update({ 
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.id);

        // Chamar generate-lyrics-internal
        const functionUrl = `${supabaseUrlEnv}/functions/v1/generate-lyrics-internal`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKeyEnv}`,
            'apikey': serviceKeyEnv
          },
          body: JSON.stringify({ job_id: approval.job_id })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        results.success++;
        console.log(`   ✅ Sucesso!`);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        console.error(`   ❌ Erro: ${errorMessage}`);
        results.errors.push({
          approval_id: approval.id,
          error: errorMessage
        });
      }

      // Delay entre chamadas (exceto na última)
      if (i < approvals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo de delay
      }
    }

    console.log('✅ Regeneração concluída:', {
      total: results.total,
      success: results.success,
      errors: results.errors.length
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        total: results.total,
        processed: results.success,
        errors: results.errors,
        message: `Regeneração concluída: ${results.success} de ${results.total} letras regeneradas com sucesso`
      }), 
      { headers: corsHeaders, status: 200 }
    );
  } catch (e: any) {
    console.error('❌ Erro geral:', e);
    
    const errorMessage = e?.message || 'Erro desconhecido ao regenerar letras';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }), 
      { headers: corsHeaders, status: 500 }
    );
  }
});

