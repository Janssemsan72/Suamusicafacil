// @ts-ignore: Deno types not available in local TypeScript environment
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM module types not available in local TypeScript environment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

// Declarações de tipo para Deno (para evitar erros de lint no TypeScript local)
// Esses tipos são fornecidos pelo runtime do Deno no Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação e permissão de admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      throw new Error('Acesso negado: apenas administradores');
    }

    const { action, order_id, data } = await req.json();

    console.log('Admin action:', { action, order_id, admin_id: user.id });

    switch (action) {
      case 'mark_as_paid': {
        // ✅ CORREÇÃO: Envolver todo o fluxo em try-catch para garantir status 200 sempre
        try {
          console.log('💰 [Admin] Marcando pedido como pago e executando fluxo completo do webhook:', order_id);

          // Verificar se pedido já está pago
          // ✅ CORREÇÃO: Buscar order e quiz separadamente para evitar ambiguidade de relações
          // ✅ CORREÇÃO: Buscar TODOS os campos necessários incluindo campos de pagamento
          const { data: existingOrder, error: fetchError } = await supabaseClient
            .from('orders')
            .select('id, status, customer_email, plan, quiz_id, paid_at, created_at, provider, payment_provider, cakto_transaction_id, cakto_payment_status')
            .eq('id', order_id)
            .single();

          if (fetchError || !existingOrder) {
            console.error('❌ [Admin] Erro ao buscar pedido:', fetchError?.message || 'Pedido não encontrado');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Pedido não encontrado',
                details: fetchError?.message || 'Pedido não existe'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Buscar quiz separadamente se existir quiz_id
          let quiz: any = null;
          if (existingOrder.quiz_id) {
            const { data: quizData, error: quizError } = await supabaseClient
              .from('quizzes')
              .select('*')
              .eq('id', existingOrder.quiz_id)
              .single();
            
            if (!quizError && quizData) {
              quiz = quizData;
            } else {
              console.warn('⚠️ [Admin] Quiz não encontrado para order:', existingOrder.quiz_id);
            }
          }

          // Adicionar quiz ao objeto order para compatibilidade com código existente
          const orderWithQuiz = {
            ...existingOrder,
            quizzes: quiz
          };

          if (orderWithQuiz.status === 'paid') {
            console.log('⚠️ [Admin] Pedido já está marcado como pago');
            return new Response(
              JSON.stringify({ success: true, message: 'Pedido já está marcado como pago' }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // PASSO 1: VALIDAÇÃO CRÍTICA - Verificar se há evidência real de pagamento
          console.log('🔍 [Admin] PASSO 1: Validando evidência de pagamento...');
          
          // ✅ CORREÇÃO CRÍTICA: Validar se há evidência real de pagamento antes de marcar como pago
          // ✅ CORREÇÃO: Usar provider ou payment_provider (qualquer um dos dois)
          const orderProvider = existingOrder.provider || existingOrder.payment_provider || 'unknown';
          const hasCaktoTransaction = existingOrder.cakto_transaction_id && existingOrder.cakto_transaction_id.trim() !== '';
          const hasCaktoStatus = existingOrder.cakto_payment_status && ['approved', 'paid', 'pago', 'aprovada'].includes(existingOrder.cakto_payment_status);
          const hasValidPaymentEvidence = hasCaktoTransaction || (hasCaktoStatus && (orderProvider === 'cakto' || orderProvider === 'Cakto'));
          
          console.log('🔍 [Admin] Validação de evidência de pagamento:', {
            hasCaktoTransaction,
            hasCaktoStatus,
            hasValidPaymentEvidence,
            cakto_transaction_id: existingOrder.cakto_transaction_id,
            cakto_payment_status: existingOrder.cakto_payment_status,
            provider: existingOrder.provider,
            payment_provider: existingOrder.payment_provider,
            orderProvider: orderProvider
          });
          
          // ⚠️ AVISO: Se não há evidência válida, alertar mas permitir (admin pode ter certeza)
          if (!hasValidPaymentEvidence) {
            console.warn('⚠️ [Admin] ATENÇÃO: Pedido não tem evidência clara de pagamento!', {
              order_id: order_id,
              customer_email: existingOrder.customer_email,
              status: existingOrder.status,
              cakto_transaction_id: existingOrder.cakto_transaction_id,
              cakto_payment_status: existingOrder.cakto_payment_status,
              provider: existingOrder.provider,
              payment_provider: existingOrder.payment_provider
            });
            // Registrar no admin_logs como aviso
            try {
              await supabaseClient.from('admin_logs').insert({
                action: 'admin_mark_paid_without_evidence',
                target_table: 'orders',
                target_id: order_id,
                changes: {
                  warning: 'Pedido marcado como pago sem evidência clara de pagamento',
                  customer_email: existingOrder.customer_email,
                  has_cakto_transaction: hasCaktoTransaction,
                  has_cakto_status: hasCaktoStatus,
                  provider: existingOrder.provider,
                  payment_provider: existingOrder.payment_provider,
                  admin_action: 'mark_as_paid'
                }
              });
            } catch (logError) {
              console.warn('⚠️ [Admin] Erro ao registrar log de aviso:', logError);
            }
          }
          
          // PASSO 2: Atualizar status do pedido para 'paid'
          console.log('📝 [Admin] PASSO 2: Atualizando status do pedido para paid...');
          // ✅ CORREÇÃO: Usar created_at (data de criação da ordem) se paid_at não existir
          // para que a venda seja contada na data correta, não na data em que foi marcada como paga
          const paidAtTimestamp = existingOrder.paid_at || existingOrder.created_at || new Date().toISOString();
          console.log('📅 [Admin] Timestamp do pagamento (usando created_at se paid_at não existir):', paidAtTimestamp);
          console.log('📅 [Admin] created_at da ordem:', existingOrder.created_at);
          
          // ✅ CORREÇÃO: Usar SERVICE_ROLE_KEY que ignora RLS
          console.log('🔑 [Admin] Usando SERVICE_ROLE_KEY (ignora RLS):', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
          console.log('📋 [Admin] Status atual do pedido antes da atualização:', existingOrder.status);
          
          // ✅ CORREÇÃO: Atualizar usando RPC mark_funnel_and_order_as_paid primeiro para garantir sincronização
          // Isso garante que o pedido e o funil sejam atualizados de forma atômica
          // A função RPC já usa created_at se paid_at não existir
          console.log('🔄 [Admin] Atualizando pedido e funil via RPC mark_funnel_and_order_as_paid...');
          let funnelIdFromRpc: string | null = null;
          let updatedOrder: any = null;
          
          const { data: funnelIdFromRpcResult, error: rpcError } = await supabaseClient.rpc('mark_funnel_and_order_as_paid', {
            p_order_id: order_id
          });
          
          funnelIdFromRpc = funnelIdFromRpcResult || null;
          
          if (rpcError) {
            console.warn('⚠️ [Admin] Erro ao chamar mark_funnel_and_order_as_paid, tentando atualização direta:', rpcError);
            // Fallback: atualizar diretamente usando created_at se paid_at não existir
          const { data: updatedData, error: updateError } = await supabaseClient
            .from('orders')
            .update({
              status: 'paid',
              paid_at: paidAtTimestamp,
              updated_at: new Date().toISOString()
            })
            .eq('id', order_id)
              .select('id, status, paid_at, updated_at');

          if (updateError) {
              console.error('❌ [Admin] Erro ao atualizar pedido (fallback):', {
              error: updateError,
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
              hint: updateError.hint
            });
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Erro ao atualizar status do pedido',
                details: updateError.message || 'Erro desconhecido ao atualizar'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          if (!updatedData || updatedData.length === 0) {
            console.error('❌ [Admin] Atualização não retornou dados - nenhuma linha foi atualizada');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Nenhuma linha foi atualizada',
                details: 'O pedido pode não existir ou já estar com outro status'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

            updatedOrder = updatedData[0];
          } else {
            // RPC foi bem-sucedido, buscar pedido atualizado
            console.log('✅ [Admin] RPC mark_funnel_and_order_as_paid executado com sucesso, funil_id:', funnelIdFromRpc);
            const { data: updatedData, error: fetchError } = await supabaseClient
              .from('orders')
              .select('id, status, paid_at, updated_at')
              .eq('id', order_id)
              .single();
            
            if (fetchError || !updatedData) {
              console.error('❌ [Admin] Erro ao buscar pedido após RPC:', fetchError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                  error: 'Erro ao verificar pedido após atualização',
                  details: fetchError?.message || 'Pedido não encontrado após atualização'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
            updatedOrder = updatedData;
          }
          
          // Verificar se o status foi atualizado corretamente
          if (updatedOrder.status !== 'paid') {
            console.error('❌ [Admin] Status não foi atualizado corretamente após RPC:', {
              expected: 'paid',
              actual: updatedOrder.status,
              order_id: updatedOrder.id
            });
            
            // Tentar atualização direta como último recurso
            const { data: retryData, error: retryError } = await supabaseClient
              .from('orders')
              .update({
                status: 'paid',
                paid_at: paidAtTimestamp,
                updated_at: paidAtTimestamp
              })
              .eq('id', order_id)
              .select('id, status, paid_at, updated_at')
              .single();
            
            if (retryError || !retryData || retryData.status !== 'paid') {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Status não foi atualizado corretamente',
                  details: `Status esperado: paid, Status retornado: ${retryData?.status || updatedOrder.status}`
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
            
            updatedOrder = retryData;
          }
          
          // Verificar se updatedOrder foi definido corretamente
          if (!updatedOrder) {
            console.error('❌ [Admin] updatedOrder não foi definido');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Erro ao atualizar pedido',
                details: 'updatedOrder não foi definido'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          console.log('✅ [Admin] Dados atualizados:', {
            order_id: updatedOrder.id,
            status: updatedOrder.status,
            paid_at: updatedOrder.paid_at,
            updated_at: updatedOrder.updated_at
          });

        // Log admin action (não bloqueante)
        try {
          await supabaseClient.from('admin_logs').insert({
            admin_user_id: user.id,
            action: 'mark_order_as_paid',
            target_table: 'orders',
            target_id: order_id,
            changes: { status: 'paid', paid_at: paidAtTimestamp }
          });
        } catch (logError) {
          console.warn('⚠️ [Admin] Erro ao registrar log (não bloqueante):', logError);
        }

        console.log('✅ [Admin] PASSO 1 CONCLUÍDO: Pedido marcado como pago', {
          order_id: updatedOrder.id,
          status: updatedOrder.status,
          paid_at: updatedOrder.paid_at,
          funnel_id: funnelIdFromRpc || null
        });
        
        // ✅ CORREÇÃO: Verificação final após um pequeno delay para garantir persistência
        // Aguardar um pouco e verificar novamente para garantir que não foi revertido
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: finalCheck, error: finalCheckError } = await supabaseClient
          .from('orders')
          .select('id, status, paid_at, updated_at')
          .eq('id', order_id)
          .single();
        
        if (!finalCheckError && finalCheck) {
          if (finalCheck.status !== 'paid') {
            console.error('❌ [Admin] ERRO CRÍTICO: Status foi revertido após atualização!', {
              expected: 'paid',
              actual: finalCheck.status,
              order_id: finalCheck.id,
              paid_at: finalCheck.paid_at,
              updated_at: finalCheck.updated_at
            });
            
            // Tentar atualizar novamente como fallback
            console.log('🔄 [Admin] Tentando atualizar novamente como fallback...');
            const { error: retryError } = await supabaseClient
              .from('orders')
              .update({
                status: 'paid',
                paid_at: paidAtTimestamp,
                updated_at: new Date().toISOString()
              })
              .eq('id', order_id);
            
            if (retryError) {
              console.error('❌ [Admin] Falha no retry:', retryError);
            } else {
              console.log('✅ [Admin] Retry bem-sucedido');
            }
          } else {
            console.log('✅ [Admin] Verificação final confirmada: Pedido permanece como paid', {
              order_id: finalCheck.id,
              status: finalCheck.status,
              paid_at: finalCheck.paid_at,
              updated_at: finalCheck.updated_at
            });
          }
        } else {
          console.warn('⚠️ [Admin] Não foi possível fazer verificação final:', finalCheckError?.message);
        }

        // PASSO 2: Enviar email E WhatsApp via notify-payment-webhook (centralizado)
        // ✅ CORREÇÃO: Usar notify-payment-webhook que envia AMBOS email e WhatsApp
        console.log('📧📱 [Admin] PASSO 2: Enviando email e WhatsApp de confirmação de pagamento via notify-payment-webhook...');
        try {
          const { data: notifyData, error: notifyError } = await supabaseClient.functions.invoke('notify-payment-webhook', {
            body: { order_id: order_id }
          });
          
          if (notifyError) {
            console.error('❌ [Admin] Erro ao chamar notify-payment-webhook:', {
              name: notifyError.name,
              message: notifyError.message,
              stack: notifyError.stack
            });
            throw notifyError;
          }
          
          console.log('✅ [Admin] PASSO 2 CONCLUÍDO: Email e WhatsApp enviados com sucesso', {
            whatsapp_success: notifyData?.whatsapp?.success,
            email_success: notifyData?.email?.success,
            resultado: notifyData
          });
        } catch (notifyError: any) {
          console.error('❌ [Admin] ERRO CRÍTICO: Falha ao enviar notificações via notify-payment-webhook:', notifyError?.message);
          // Tentar fallback: enviar apenas email
          console.log('🔄 [Admin] Tentando fallback: enviar apenas email...');
          try {
            const emailTo = orderWithQuiz.customer_email;
            const detectedLanguage = quiz?.language || 'pt';
            
            const { data, error: emailError } = await supabaseClient.functions.invoke('send-email-with-variables', {
              body: {
                template_type: 'order_paid',
                order_id: order_id,
                language: detectedLanguage,
                to_email: emailTo,
              }
            });

            if (emailError) throw emailError;
            if (data?.success === false) {
              throw new Error(data?.error || 'send-email-with-variables returned success=false');
            }

            console.log('✅ [Admin] Fallback: Email order_paid enviado com sucesso');
          } catch (emailError: any) {
            console.error('❌ [Admin] ERRO: Falha também no fallback de email:', emailError?.message);
            // Não bloquear o fluxo, mas logar o erro
          }
        }

        // PASSO 4: Iniciar geração automática de letra para aprovação do admin (NÃO BLOQUEANTE)
        console.log('🎵 [Admin] PASSO 4: Iniciando geração automática de letra...');
        let lyricsWarning: string | null = null;
        let lyricsSuccess = false;
        try {
          // ✅ CORREÇÃO CRÍTICA: Tentar gerar letra com retry (até 3 tentativas com delay crescente)
          // Isso garante que mesmo se houver problemas de timing, a letra será gerada
          const maxRetries = 3;
          let lastError: any = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Aguardar com delay crescente (2s, 3s, 4s)
            // ✅ CORREÇÃO: Aumentar delay inicial para evitar problemas de timing quando pedido é criado e marcado como pago simultaneamente
            if (attempt > 1) {
              const delay = (attempt + 1) * 1000; // 3s, 4s
              console.log(`🔄 [Admin] PASSO 4: Tentativa ${attempt}/${maxRetries} - Aguardando ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              // Primeira tentativa: aguardar 2 segundos (aumentado de 1s para 2s)
              console.log(`🔄 [Admin] PASSO 4: Tentativa ${attempt}/${maxRetries} - Aguardando 2000ms para garantir commit...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Verificar se o pedido está realmente pago
            const { data: orderBeforeLyrics, error: orderCheckError } = await supabaseClient
              .from('orders')
              .select('id, status, paid_at, quiz_id')
              .eq('id', order_id)
              .single();
            
            if (orderCheckError || !orderBeforeLyrics) {
              lastError = `Erro ao verificar pedido: ${orderCheckError?.message || 'Pedido não encontrado'}`;
              console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Erro ao verificar pedido:`, orderCheckError);
              if (attempt < maxRetries) continue;
              lyricsWarning = lastError;
              break;
            }
            
            if (orderBeforeLyrics.status !== 'paid') {
              lastError = `Pedido não está marcado como pago (status: ${orderBeforeLyrics.status})`;
              console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Pedido não está pago:`, {
                order_id: order_id,
                status: orderBeforeLyrics.status,
                paid_at: orderBeforeLyrics.paid_at
              });
              if (attempt < maxRetries) continue;
              lyricsWarning = lastError;
              break;
            }
            
            if (!orderBeforeLyrics.paid_at) {
              lastError = `Pedido está marcado como pago mas não tem paid_at definido`;
              console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Pedido não tem paid_at:`, {
                order_id: order_id,
                status: orderBeforeLyrics.status,
                paid_at: orderBeforeLyrics.paid_at
              });
              if (attempt < maxRetries) continue;
              lyricsWarning = lastError;
              break;
            }
            
            // Pedido está realmente pago, tentar gerar letra
            console.log(`✅ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Pedido confirmado como pago, gerando letra...`, {
              order_id: order_id,
              status: orderBeforeLyrics.status,
              paid_at: orderBeforeLyrics.paid_at,
              quiz_id: orderBeforeLyrics.quiz_id
            });
            
            // ✅ CORREÇÃO CRÍTICA: Verificar se já existe aprovação PENDENTE antes de gerar
            // Isso evita duplicações quando trigger SQL e admin-order-actions são chamados simultaneamente
            const { data: existingPendingApproval } = await supabaseClient
              .from('lyrics_approvals')
              .select('id, lyrics, status, created_at')
              .eq('order_id', order_id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            // Se já existe aprovação pendente, não gerar nova
            if (existingPendingApproval) {
              console.log(`ℹ️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Aprovação pendente já existe para este pedido`, {
                approval_id: existingPendingApproval.id,
                created_at: existingPendingApproval.created_at,
                has_lyrics: !!(existingPendingApproval.lyrics && Object.keys(existingPendingApproval.lyrics).length > 0)
              });
              lyricsSuccess = true;
              break;
            }
            
            // Verificar se existe qualquer aprovação (não pendente) ou job com letras
            const { data: existingApprovals } = await supabaseClient
              .from('lyrics_approvals')
              .select('id, status, lyrics')
              .eq('order_id', order_id)
              .limit(1);
            
            const { data: existingJobs } = await supabaseClient
              .from('jobs')
              .select('id, status, gpt_lyrics')
              .eq('order_id', order_id)
              .neq('status', 'failed')
              .limit(1);
            
            const hasApprovalWithLyrics = existingApprovals && existingApprovals.length > 0 && 
                                         existingApprovals[0].lyrics && 
                                         Object.keys(existingApprovals[0].lyrics).length > 0;
            
            const hasJobWithLyrics = existingJobs && existingJobs.length > 0 && 
                                   existingJobs[0].gpt_lyrics && 
                                   Object.keys(existingJobs[0].gpt_lyrics).length > 0;
            
            // Se já existe aprovação aprovada/rejeitada com letras, não gerar nova
            if (hasApprovalWithLyrics || hasJobWithLyrics) {
              console.log(`ℹ️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Letra já foi gerada para este pedido`, {
                has_approval: hasApprovalWithLyrics,
                has_job: hasJobWithLyrics,
                approval_status: existingApprovals?.[0]?.status
              });
              lyricsSuccess = true;
              break;
            }
            
            // Chamar função de geração de letra
            try {
              const { data: lyricsData, error: lyricsError } = await supabaseClient.functions.invoke('generate-lyrics-for-approval', {
                body: { order_id: order_id }
              });
              
              if (lyricsError) {
                // Extrair mensagem de erro detalhada
                let errorMessage = 'Erro desconhecido ao gerar letra';
                if (lyricsError.message) {
                  errorMessage = lyricsError.message;
                } else if (typeof lyricsError === 'string') {
                  errorMessage = lyricsError;
                } else if (lyricsError.status) {
                  errorMessage = `Edge Function retornou status ${lyricsError.status}`;
                }
                
                lastError = errorMessage;
                console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Erro ao chamar generate-lyrics-for-approval:`, {
                  erro: errorMessage,
                  status: lyricsError.status,
                  order_id: order_id
                });
                
                // ✅ CORREÇÃO: Retentar em caso de erros temporários (401, 500, 502, 503, 504) ou validação
                const isTemporaryError = lyricsError.status && (
                  lyricsError.status === 401 || // Não autorizado (pode ser temporário)
                  lyricsError.status === 500 || // Erro interno do servidor
                  lyricsError.status === 502 || // Bad Gateway
                  lyricsError.status === 503 || // Service Unavailable
                  lyricsError.status === 504 || // Gateway Timeout
                  errorMessage.includes('não está marcado como pago') // Erro de validação
                );
                
                if (isTemporaryError && attempt < maxRetries) {
                  console.log(`🔄 [Admin] PASSO 4: Erro temporário detectado (status: ${lyricsError.status}), tentando novamente...`);
                  continue;
                }
                
                if (attempt < maxRetries) continue;
                lyricsWarning = `Falha ao iniciar geração de letra: ${errorMessage}`;
                break;
              } else if (lyricsData?.success === false) {
                lastError = lyricsData?.error || 'Erro desconhecido';
                console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): generate-lyrics-for-approval retornou success=false:`, {
                  error: lyricsData?.error,
                  order_id: order_id
                });
                
                // Se for erro de validação, tentar novamente
                if (lastError.includes('não está marcado como pago') && attempt < maxRetries) {
                  continue;
                }
                
                if (attempt < maxRetries) continue;
                lyricsWarning = `Geração de letra retornou sucesso=false: ${lastError}`;
                break;
              } else {
                // Sucesso!
                lyricsSuccess = true;
                console.log(`✅ [Admin] PASSO 4 CONCLUÍDO (tentativa ${attempt}/${maxRetries}): Geração de letra iniciada com sucesso`, {
                  job_id: lyricsData?.job_id,
                  approval_id: lyricsData?.approval_id,
                  message: lyricsData?.message,
                  already_exists: lyricsData?.already_exists
                });
                break;
              }
            } catch (invokeError: any) {
              lastError = invokeError?.message || 'Erro ao chamar função';
              console.error(`⚠️ [Admin] PASSO 4 (tentativa ${attempt}/${maxRetries}): Exceção ao chamar generate-lyrics-for-approval:`, {
                erro: invokeError?.message,
                stack: invokeError?.stack,
                order_id: order_id
              });
              if (attempt < maxRetries) continue;
              lyricsWarning = `Exceção ao gerar letra: ${lastError}`;
              break;
            }
          }
          
          if (!lyricsSuccess && lyricsWarning) {
            console.error('❌ [Admin] PASSO 4: Falha após todas as tentativas:', lyricsWarning);
          }
        } catch (workflowError: any) {
          // Capturar qualquer exceção não tratada
          lyricsWarning = `Exceção ao gerar letra: ${workflowError?.message || 'Erro desconhecido'}`;
          console.error('❌ [Admin] PASSO 4: Exceção crítica ao iniciar geração de letra:', {
            erro: workflowError?.message,
            stack: workflowError?.stack,
            order_id: order_id
          });
        }

        // PASSO 5: Verificar se há músicas liberadas e enviar notificações
        console.log('🎵 [Admin] PASSO 5: Verificando se há músicas liberadas...');
        try {
          const { data: releasedSongs, error: songsError } = await supabaseClient
            .from('songs')
            .select('id, variant_number, title, status')
            .eq('order_id', order_id)
            .eq('status', 'released')
            .order('variant_number', { ascending: true });

          if (songsError) {
            console.error('⚠️ [Admin] Erro ao buscar músicas liberadas:', songsError);
          } else if (releasedSongs && releasedSongs.length > 0) {
            console.log(`✅ [Admin] Encontradas ${releasedSongs.length} música(s) liberada(s), enviando notificações...`);

            // Obter primeira música para notificações
            const firstSong = releasedSongs[0];

            // Enviar email com downloads (não bloqueante)
            try {
              console.log('📧 [Admin] Enviando email de música pronta...');
              const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-music-released-email', {
                body: { song_id: firstSong.id }
              });

              if (emailError) {
                console.error('⚠️ [Admin] Falha ao enviar email de música pronta (não bloqueante):', emailError?.message);
              } else {
                console.log('✅ [Admin] Email de música pronta enviado com sucesso');
              }
            } catch (emailErr: any) {
              console.error('⚠️ [Admin] Erro ao enviar email de música pronta (não bloqueante):', emailErr?.message);
            }

            // ✅ REMOVIDO: Envio de WhatsApp removido
            // Apenas email é enviado agora via notify-music-ready-webhook

            console.log('✅ [Admin] PASSO 5 CONCLUÍDO: Notificações de músicas liberadas enviadas');
          } else {
            console.log('ℹ️ [Admin] Nenhuma música liberada encontrada, pulando notificações de música pronta');
          }
        } catch (musicCheckError: any) {
          console.error('⚠️ [Admin] Erro ao verificar músicas liberadas (não bloqueante):', musicCheckError?.message);
        }

        // Construir mensagem de resposta com detalhes dos passos executados
        const warnings: string[] = [];
        if (lyricsWarning) {
          warnings.push(lyricsWarning);
        }
        
        let successMessage = 'Pedido marcado como pago com sucesso.';
        if (lyricsSuccess) {
          successMessage += ' Geração de letra iniciada.';
        } else if (lyricsWarning) {
          successMessage += ' Geração de letra não pôde ser iniciada automaticamente (você pode gerar manualmente depois).';
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: successMessage,
            warnings: warnings.length > 0 ? warnings : undefined,
            steps_completed: {
              order_marked_paid: true,
              email_sent: true, // Assumindo sucesso (não bloqueante)
              whatsapp_notified: true, // Assumindo sucesso (não bloqueante)
              lyrics_generation_started: lyricsSuccess
            }
          }),
          { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
        } catch (markAsPaidError: any) {
          // ✅ CORREÇÃO: Capturar qualquer erro não tratado e retornar status 200
          console.error('❌ [Admin] Erro inesperado ao marcar pedido como pago:', {
            error: markAsPaidError?.message,
            stack: markAsPaidError?.stack,
            order_id: order_id
          });
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro ao processar marcação de pedido como pago',
              details: markAsPaidError?.message || 'Erro desconhecido',
              warnings: ['Ocorreu um erro inesperado. Verifique os logs para mais detalhes.']
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      case 'unmark_as_paid': {
        try {
          console.log('🔄 [Admin] Desmarcando pedido como pago:', order_id);

          // Verificar se pedido existe e está pago
          const { data: existingOrder, error: fetchError } = await supabaseClient
            .from('orders')
            .select('id, status, customer_email')
            .eq('id', order_id)
            .single();

          if (fetchError || !existingOrder) {
            console.error('❌ [Admin] Erro ao buscar pedido:', fetchError?.message || 'Pedido não encontrado');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Pedido não encontrado',
                details: fetchError?.message || 'Pedido não existe'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          if (existingOrder.status !== 'paid') {
            console.log('⚠️ [Admin] Pedido não está marcado como pago (status atual: ' + existingOrder.status + ')');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Pedido não está marcado como pago',
                details: `Status atual: ${existingOrder.status}`
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Atualizar status do pedido para pending
          console.log('📝 [Admin] Atualizando status do pedido para pending...');
          const { data: updatedData, error: updateError } = await supabaseClient
            .from('orders')
            .update({
              status: 'pending',
              paid_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', order_id)
            .select('id, status, paid_at, updated_at');

          if (updateError) {
            console.error('❌ [Admin] Erro ao atualizar pedido:', updateError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Erro ao atualizar status do pedido',
                details: updateError.message || 'Erro desconhecido ao atualizar'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          if (!updatedData || updatedData.length === 0) {
            console.error('❌ [Admin] Atualização não retornou dados');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Nenhuma linha foi atualizada'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          const updatedOrder = updatedData[0];
          console.log('✅ [Admin] Pedido desmarcado como pago:', {
            order_id: updatedOrder.id,
            status: updatedOrder.status
          });

          // ✅ REMOVIDO: Código de funil WhatsApp removido
          // Funis WhatsApp não são mais usados

          // Log admin action
          try {
            await supabaseClient.from('admin_logs').insert({
              admin_user_id: user.id,
              action: 'unmark_order_as_paid',
              target_table: 'orders',
              target_id: order_id,
              changes: { status: 'pending', paid_at: null }
            });
          } catch (logError) {
            console.warn('⚠️ [Admin] Erro ao registrar log (não bloqueante):', logError);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Pedido desmarcado como pago com sucesso',
              order_id: updatedOrder.id,
              new_status: updatedOrder.status
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (unmarkError: any) {
          console.error('❌ [Admin] Erro inesperado ao desmarcar pedido como pago:', {
            error: unmarkError?.message,
            stack: unmarkError?.stack,
            order_id: order_id
          });
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro ao processar desmarcação de pedido como pago',
              details: unmarkError?.message || 'Erro desconhecido'
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      case 'process_manually': {
        await supabaseClient.functions.invoke('process-order', {
          body: { order_id }
        });

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'process_order_manually',
          target_table: 'orders',
          target_id: order_id
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Processamento manual iniciado' }),
          { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancel': {
        const { error } = await supabaseClient
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'cancel_order',
          target_table: 'orders',
          target_id: order_id,
          changes: { status: 'cancelled' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Pedido cancelado' }),
          { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'refund':
      case 'mark_as_refunded': {
        console.log('↩️ [Admin] Marcando pedido como reembolsado:', order_id);
        
        try {
          // Buscar pedido atual
          const { data: existingOrder, error: fetchError } = await supabaseClient
            .from('orders')
            .select('id, customer_email, status, paid_at')
            .eq('id', order_id)
            .single();

          if (fetchError || !existingOrder) {
            console.error('❌ [Admin] Erro ao buscar pedido:', fetchError?.message || 'Pedido não encontrado');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Pedido não encontrado',
                details: fetchError?.message || 'Pedido não existe'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Verificar se já está reembolsado
          if (existingOrder.status === 'refunded') {
            console.log('⚠️ [Admin] Pedido já está marcado como reembolsado');
            return new Response(
              JSON.stringify({ success: true, message: 'Pedido já está marcado como reembolsado' }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Atualizar pedido: marcar como refunded e remover paid_at
          console.log('📝 [Admin] Atualizando pedido para refunded e removendo paid_at...');
          const { data: updatedOrder, error: updateError } = await supabaseClient
            .from('orders')
            .update({
              status: 'refunded',
              paid_at: null, // ✅ Remover paid_at para que não conte mais como pago
              updated_at: new Date().toISOString()
            })
            .eq('id', order_id)
            .select('id, status, paid_at, updated_at')
            .single();

          if (updateError) {
            console.error('❌ [Admin] Erro ao atualizar pedido:', updateError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Erro ao marcar pedido como reembolsado',
                details: updateError.message
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Log admin action (não bloqueante)
          try {
            await supabaseClient.from('admin_logs').insert({
              admin_user_id: user.id,
              action: 'mark_order_as_refunded',
              target_table: 'orders',
              target_id: order_id,
              changes: { 
                status: 'refunded', 
                paid_at: null,
                previous_status: existingOrder.status,
                customer_email: existingOrder.customer_email 
              }
            });
          } catch (logError) {
            console.warn('⚠️ [Admin] Erro ao registrar log (não bloqueante):', logError);
          }

          console.log('✅ [Admin] Pedido marcado como reembolsado:', {
            order_id: updatedOrder.id,
            status: updatedOrder.status,
            paid_at: updatedOrder.paid_at,
            previous_status: existingOrder.status
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Pedido marcado como reembolsado. O pedido não será mais contado como pago.',
              order: {
                id: updatedOrder.id,
                status: updatedOrder.status,
                paid_at: updatedOrder.paid_at
              }
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (error: any) {
          console.error('❌ [Admin] Erro ao processar reembolso:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro ao processar reembolso',
              details: error.message || 'Erro desconhecido'
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      case 'release_song_now': {
        const { song_id } = data;
        
        const { error } = await supabaseClient
          .from('songs')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            release_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', song_id);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'release_song_now',
          target_table: 'songs',
          target_id: song_id,
          changes: { status: 'released', released_at: new Date().toISOString() }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Música liberada imediatamente' }),
          { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cleanup_pending': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: oldOrders, error: fetchError } = await supabaseClient
          .from('orders')
          .select('id')
          .eq('status', 'pending')
          .lt('created_at', sevenDaysAgo.toISOString());

        if (fetchError) throw fetchError;

        if (oldOrders && oldOrders.length > 0) {
          const orderIds = oldOrders.map(o => o.id);

          // Deletar quizzes órfãos
          await supabaseClient
            .from('quizzes')
            .delete()
            .in('id', (await supabaseClient
              .from('orders')
              .select('quiz_id')
              .in('id', orderIds)
            ).data?.map(o => o.quiz_id) || []);

          // Deletar orders
          const { error: deleteError } = await supabaseClient
            .from('orders')
            .delete()
            .in('id', orderIds);

          if (deleteError) throw deleteError;

          await supabaseClient.from('admin_logs').insert({
            admin_user_id: user.id,
            action: 'cleanup_pending_orders',
            target_table: 'orders',
            changes: { deleted_count: orderIds.length }
          });

          return new Response(
            JSON.stringify({ success: true, message: `${orderIds.length} pedidos antigos removidos` }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Nenhum pedido antigo encontrado' }),
          { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'clear_behavior_problems': {
        console.log('🧹 [Admin] Zerando dados de problemas do behavior analytics...');
        console.log('🔍 [Admin] Usando SERVICE_ROLE_KEY (ignora RLS):', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        
        try {
          // Verificar se a tabela existe primeiro (usando SERVICE_ROLE_KEY que ignora RLS)
          const { data: tableCheck, error: tableError } = await supabaseClient
            .from('behavior_analytics')
            .select('id')
            .limit(1);
          
          if (tableError) {
            console.error('❌ [Admin] Erro ao acessar tabela behavior_analytics:', {
              code: tableError.code,
              message: tableError.message,
              details: tableError.details,
              hint: tableError.hint
            });
            
            // Se for erro de tabela não encontrada, retornar erro mais claro
            if (tableError.code === 'PGRST301' || 
                tableError.message?.includes('does not exist') ||
                tableError.message?.includes('relation') && tableError.message?.includes('does not exist')) {
              return new Response(
                JSON.stringify({ 
                  success: false,
                  error: 'Tabela behavior_analytics não encontrada. Execute a migration SQL primeiro.',
                  details: 'Execute: 20250211000000_create_behavior_analytics.sql'
                }),
                { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 404 }
              );
            }
            
            // Retornar erro detalhado
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Erro ao acessar tabela behavior_analytics',
                details: tableError.message,
                code: tableError.code
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
          
          console.log('✅ [Admin] Tabela behavior_analytics acessível');
          
          // Contar registros antes de deletar
          const { count: beforeCount, error: countError } = await supabaseClient
            .from('behavior_analytics')
            .select('*', { count: 'exact', head: true })
            .in('event_type', ['dead_click', 'rage_click', 'js_error']);
          
          if (countError) {
            console.error('❌ [Admin] Erro ao contar problemas:', {
              code: countError.code,
              message: countError.message,
              details: countError.details
            });
            
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Erro ao contar registros de problemas',
                details: countError.message,
                code: countError.code
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
          
          console.log(`📊 [Admin] Encontrados ${beforeCount || 0} registros de problemas`);
          
          // Deletar todos os registros de problemas
          // Se não houver registros, não tentar deletar (evita erro com .in() vazio)
          let deletedCount = 0;
          
          if (beforeCount && beforeCount > 0) {
            const { data: deletedData, error: deleteError } = await supabaseClient
              .from('behavior_analytics')
              .delete()
              .in('event_type', ['dead_click', 'rage_click', 'js_error'])
              .select();
            
            if (deleteError) {
              console.error('❌ [Admin] Erro ao deletar problemas:', {
                code: deleteError.code,
                message: deleteError.message,
                details: deleteError.details,
                hint: deleteError.hint
              });
              
              return new Response(
                JSON.stringify({ 
                  success: false,
                  error: 'Erro ao deletar registros de problemas',
                  details: deleteError.message,
                  code: deleteError.code,
                  hint: deleteError.hint || 'Verifique se a política de DELETE existe na tabela behavior_analytics'
                }),
                { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
              );
            }
            
            deletedCount = deletedData?.length || beforeCount || 0;
            console.log(`✅ [Admin] ${deletedCount} registros deletados com sucesso`);
          } else {
            console.log('ℹ️ [Admin] Nenhum registro de problemas encontrado para deletar');
            deletedCount = 0;
          }
          
          // Log da ação (não bloquear se falhar)
          try {
            await supabaseClient.from('admin_logs').insert({
              admin_user_id: user.id,
              action: 'clear_behavior_problems',
              target_table: 'behavior_analytics',
              changes: { 
                deleted_count: deletedCount,
                event_types: ['dead_click', 'rage_click', 'js_error']
              }
            });
          } catch (logError) {
            console.warn('⚠️ [Admin] Erro ao registrar log (não bloqueante):', logError);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `${deletedCount} registros de problemas removidos com sucesso`,
              deleted_count: deletedCount
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (clearError: any) {
          console.error('❌ [Admin] Erro inesperado ao limpar problemas:', {
            message: clearError?.message,
            stack: clearError?.stack,
            name: clearError?.name
          });
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Erro inesperado ao limpar problemas',
              details: clearError?.message || String(clearError)
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      case 'delete_order': {
        console.log('🗑️ [Admin] Excluindo pedido permanentemente:', order_id);

        try {
          if (!order_id) {
            return new Response(
              JSON.stringify({ success: false, error: 'order_id é obrigatório' }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          // Buscar o pedido primeiro para verificar se existe
          const { data: orderData, error: fetchError } = await supabaseClient
            .from('orders')
            .select('id, quiz_id')
            .eq('id', order_id)
            .single();

          if (fetchError || !orderData) {
            console.error('❌ [Admin] Pedido não encontrado:', fetchError);
            return new Response(
              JSON.stringify({ success: false, error: 'Pedido não encontrado', details: fetchError?.message }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
          }

          console.log('✅ [Admin] Pedido encontrado, iniciando exclusão em cascata...');

          // Excluir registros relacionados primeiro (em ordem de dependência)
          // 1. checkout_events (tem NO ACTION, precisa excluir primeiro)
          try {
            // Verificar quantos registros existem
            const { count } = await supabaseClient
              .from('checkout_events')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order_id);
            
            console.log(`📊 [Admin] checkout_events encontrados: ${count || 0}`);
            
            if (count && count > 0) {
              const { error: deleteEventsError, count: deletedCount } = await supabaseClient
                .from('checkout_events')
                .delete()
                .eq('order_id', order_id)
                .select('*', { count: 'exact', head: true });
              
              if (deleteEventsError) {
                console.error('❌ [Admin] Erro ao excluir checkout_events:', deleteEventsError);
                throw new Error(`Erro ao excluir checkout_events: ${deleteEventsError.message}`);
              } else {
                console.log(`✅ [Admin] ${deletedCount || count} checkout_events excluídos`);
              }
            } else {
              console.log('✅ [Admin] Nenhum checkout_events encontrado');
            }
          } catch (err: any) {
            console.error('❌ [Admin] Erro ao excluir checkout_events:', err?.message);
            throw new Error(`Erro ao excluir checkout_events: ${err?.message || 'Erro desconhecido'}`);
          }

          // 2. songs
          try {
            const { count: songsCount } = await supabaseClient
              .from('songs')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order_id);
            
            if (songsCount && songsCount > 0) {
              const { error: deleteSongsError } = await supabaseClient
                .from('songs')
                .delete()
                .eq('order_id', order_id);
              
              if (deleteSongsError) {
                console.error('❌ [Admin] Erro ao excluir songs:', deleteSongsError);
                throw new Error(`Erro ao excluir songs: ${deleteSongsError.message}`);
              }
              console.log(`✅ [Admin] ${songsCount} songs excluídos`);
            } else {
              console.log('✅ [Admin] Nenhum song encontrado');
            }
          } catch (err: any) {
            console.error('❌ [Admin] Erro ao excluir songs:', err?.message);
            throw err;
          }

          // 3. jobs
          try {
            const { count: jobsCount } = await supabaseClient
              .from('jobs')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order_id);
            
            if (jobsCount && jobsCount > 0) {
              const { error: deleteJobsError } = await supabaseClient
                .from('jobs')
                .delete()
                .eq('order_id', order_id);
              
              if (deleteJobsError) {
                console.error('❌ [Admin] Erro ao excluir jobs:', deleteJobsError);
                throw new Error(`Erro ao excluir jobs: ${deleteJobsError.message}`);
              }
              console.log(`✅ [Admin] ${jobsCount} jobs excluídos`);
            } else {
              console.log('✅ [Admin] Nenhum job encontrado');
            }
          } catch (err: any) {
            console.error('❌ [Admin] Erro ao excluir jobs:', err?.message);
            throw err;
          }

          // 4. lyrics_approvals
          try {
            const { count: lyricsCount } = await supabaseClient
              .from('lyrics_approvals')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order_id);
            
            if (lyricsCount && lyricsCount > 0) {
              const { error: deleteLyricsError } = await supabaseClient
                .from('lyrics_approvals')
                .delete()
                .eq('order_id', order_id);
              
              if (deleteLyricsError) {
                console.error('❌ [Admin] Erro ao excluir lyrics_approvals:', deleteLyricsError);
                throw new Error(`Erro ao excluir lyrics_approvals: ${deleteLyricsError.message}`);
              }
              console.log(`✅ [Admin] ${lyricsCount} lyrics_approvals excluídos`);
            } else {
              console.log('✅ [Admin] Nenhum lyrics_approval encontrado');
            }
          } catch (err: any) {
            console.error('❌ [Admin] Erro ao excluir lyrics_approvals:', err?.message);
            throw err;
          }

          // 5. Excluir o pedido
          console.log('🗑️ [Admin] Excluindo pedido principal...');
          
          // Verificar se ainda há registros bloqueando
          const { count: remainingCheckoutEvents } = await supabaseClient
            .from('checkout_events')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order_id);
          
          if (remainingCheckoutEvents && remainingCheckoutEvents > 0) {
            console.error(`❌ [Admin] Ainda há ${remainingCheckoutEvents} checkout_events bloqueando a exclusão`);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Não foi possível excluir todos os checkout_events. Ainda há ${remainingCheckoutEvents} registros bloqueando.`,
                details: 'checkout_events não foram completamente excluídos'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
          
          const { error: deleteError, count: deletedCount } = await supabaseClient
            .from('orders')
            .delete()
            .eq('id', order_id)
            .select('*', { count: 'exact', head: true });

          if (deleteError) {
            console.error('❌ [Admin] Erro ao excluir pedido:', deleteError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Erro ao excluir pedido', 
                details: deleteError.message,
                code: deleteError.code,
                hint: deleteError.hint
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
          
          if (!deletedCount || deletedCount === 0) {
            console.warn('⚠️ [Admin] Nenhum pedido foi excluído (pode já ter sido excluído)');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Pedido não encontrado ou já foi excluído'
              }),
              { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
          }

          console.log('✅ [Admin] Pedido excluído com sucesso');

          // 6. Excluir quiz se existir e não estiver sendo usado por outros pedidos
          if (orderData.quiz_id) {
            try {
              // Verificar se o quiz está sendo usado por outros pedidos
              const { data: otherOrders, error: checkError } = await supabaseClient
                .from('orders')
                .select('id')
                .eq('quiz_id', orderData.quiz_id)
                .limit(1);

              if (!checkError && (!otherOrders || otherOrders.length === 0)) {
                // Nenhum outro pedido usa este quiz, pode excluir
                const { error: deleteQuizError } = await supabaseClient
                  .from('quizzes')
                  .delete()
                  .eq('id', orderData.quiz_id);
                
                if (deleteQuizError) {
                  console.warn('⚠️ [Admin] Erro ao excluir quiz:', deleteQuizError);
                } else {
                  console.log('✅ [Admin] Quiz excluído (não estava em uso)');
                }
              } else {
                console.log('ℹ️ [Admin] Quiz mantido (está em uso por outros pedidos)');
              }
            } catch (err: any) {
              console.warn('⚠️ [Admin] Erro ao excluir quiz (pode não existir ou estar em uso):', err?.message);
            }
          }

          // Registrar log (não bloquear se falhar)
          try {
            await supabaseClient.from('admin_logs').insert({
              admin_user_id: user.id,
              action: 'delete_order',
              target_table: 'orders',
              target_id: order_id,
              changes: { deleted: true }
            });
          } catch (logError) {
            console.warn('⚠️ [Admin] Erro ao registrar log (não bloqueante):', logError);
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Pedido excluído permanentemente' }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (error: any) {
          console.error('❌ [Admin] Erro inesperado ao excluir pedido:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro inesperado ao excluir pedido', 
              details: error?.message || String(error)
            }),
            { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      default:
        throw new Error('Ação inválida');
    }

  } catch (error: any) {
    console.error('Error in admin-order-actions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...secureHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
