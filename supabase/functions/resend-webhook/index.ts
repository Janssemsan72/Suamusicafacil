/**
 * Edge Function: resend-webhook
 * 
 * Webhook para receber eventos do Resend (bounces, complaints, deliveries, etc.)
 * Atualiza status de emails no banco de dados baseado nos eventos
 * 
 * Configurar no Resend Dashboard:
 * - URL: https://[seu-projeto].supabase.co/functions/v1/resend-webhook
 * - Events: delivery, bounce, complaint, opened, clicked
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ResendWebhookEvent {
  type: 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    created_at: string;
    // Para bounces
    bounce_type?: 'hard_bounce' | 'soft_bounce';
    delivery_status?: string;
    // Para complaints
    complaint_feedback_type?: string;
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: { ...secureHeaders, ...corsHeaders } 
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resend envia eventos como array
    const events: ResendWebhookEvent[] = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { 
          status: 400, 
          headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📧 [ResendWebhook] Recebidos ${events.length} evento(s)`);

    const results = [];

    for (const event of events) {
      try {
        const { type, data } = event;
        const emailId = data.email_id;
        const recipientEmail = data.to?.[0] || data.to?.[0];

        if (!emailId) {
          console.warn('⚠️ [ResendWebhook] Evento sem email_id:', event);
          continue;
        }

        console.log(`📧 [ResendWebhook] Processando evento: ${type} para email ${emailId}`);

        let status: string | null = null;
        let metadata: Record<string, any> = {};

        // Mapear tipo de evento para status
        switch (type) {
          case 'email.delivered':
            status = 'delivered';
            metadata = {
              delivered_at: data.created_at,
              from: data.from,
              to: data.to,
            };
            break;

          case 'email.bounced':
            status = 'bounced';
            metadata = {
              bounced_at: data.created_at,
              bounce_type: data.bounce_type || 'unknown',
              delivery_status: data.delivery_status,
              from: data.from,
              to: data.to,
            };
            
            // Se for hard bounce, adicionar à lista de bounces permanentes
            if (data.bounce_type === 'hard_bounce' && recipientEmail) {
              // Podemos criar uma tabela de bounces permanentes se necessário
              console.log(`⚠️ [ResendWebhook] Hard bounce detectado para ${recipientEmail}`);
            }
            break;

          case 'email.complained':
            status = 'complained';
            metadata = {
              complained_at: data.created_at,
              complaint_feedback_type: data.complaint_feedback_type,
              from: data.from,
              to: data.to,
            };
            
            // Adicionar à lista de unsubscribes automaticamente
            if (recipientEmail) {
              try {
                await supabase.rpc('add_email_unsubscribe', {
                  p_email: recipientEmail.toLowerCase().trim(),
                  p_token: `complaint-${Date.now()}`,
                  p_reason: 'Spam complaint',
                  p_source: 'webhook',
                  p_metadata: {
                    complaint_feedback_type: data.complaint_feedback_type,
                    complained_at: data.created_at,
                  }
                });
                console.log(`✅ [ResendWebhook] Email ${recipientEmail} adicionado à lista de unsubscribes por complaint`);
              } catch (error) {
                console.error('❌ [ResendWebhook] Erro ao adicionar unsubscribe:', error);
              }
            }
            break;

          case 'email.opened':
            status = 'opened';
            metadata = {
              opened_at: data.created_at,
              from: data.from,
              to: data.to,
            };
            break;

          case 'email.clicked':
            status = 'clicked';
            metadata = {
              clicked_at: data.created_at,
              from: data.from,
              to: data.to,
            };
            break;

          default:
            console.warn(`⚠️ [ResendWebhook] Tipo de evento desconhecido: ${type}`);
            continue;
        }

        if (!status) {
          continue;
        }

        // Buscar metadata atual antes de atualizar
        const { data: currentLog } = await supabase
          .from('email_logs')
          .select('metadata')
          .eq('resend_email_id', emailId)
          .single();

        // Mesclar metadata existente com novo
        const mergedMetadata = {
          ...(currentLog?.metadata || {}),
          ...metadata
        };

        // Atualizar email_logs com o novo status
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            status: status,
            metadata: mergedMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('resend_email_id', emailId);

        if (updateError) {
          console.error(`❌ [ResendWebhook] Erro ao atualizar email_logs para ${emailId}:`, updateError);
          
          // Tentar inserir se não existir (pode acontecer se o email foi enviado antes do log)
          if (updateError.code === 'PGRST116') {
            console.log(`ℹ️ [ResendWebhook] Email ${emailId} não encontrado em email_logs, tentando inserir...`);
            
            const { error: insertError } = await supabase
              .from('email_logs')
              .insert({
                resend_email_id: emailId,
                recipient_email: recipientEmail || 'unknown@example.com',
                status: status,
                email_type: 'unknown',
                template_used: 'unknown',
                metadata: metadata,
                sent_at: data.created_at,
              });

            if (insertError) {
              console.error(`❌ [ResendWebhook] Erro ao inserir email_logs para ${emailId}:`, insertError);
            } else {
              console.log(`✅ [ResendWebhook] Email ${emailId} inserido em email_logs`);
            }
          }
        } else {
          console.log(`✅ [ResendWebhook] Email ${emailId} atualizado para status: ${status}`);
        }

        results.push({
          email_id: emailId,
          type: type,
          status: status,
          success: !updateError
        });

      } catch (eventError) {
        console.error('❌ [ResendWebhook] Erro ao processar evento:', eventError);
        results.push({
          error: eventError instanceof Error ? eventError.message : 'Unknown error'
        });
      }
    }

    // Resend espera 200 OK
    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results: results
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [ResendWebhook] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...secureHeaders, ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

