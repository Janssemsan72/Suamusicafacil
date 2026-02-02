/**
 * Edge Function: Marcação Manual de Pedidos como Pagos
 * 
 * Esta função permite que administradores marquem pedidos como pagos manualmente
 * com auditoria completa. Apenas pedidos sem webhook válido podem ser marcados manualmente.
 * 
 * Requisitos:
 * - Usuário deve ser admin
 * - Pedido não pode ter webhook válido processado
 * - Todas as ações são registradas no admin_logs
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";
import { createErrorResponse, isValidUUID } from "../_shared/error-handler.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Este endpoint só aceita requisições POST'
      }),
      { 
        status: 405, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
    }
    
    const supabaseClient = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false } }
    );
    
    // Obter token de autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verificar se é service role key (chamada interna)
    const token = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = token === serviceKey;
    
    // Se não for service role, verificar se é usuário admin
    let userId: string | null = null;
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      userId = user.id;
      
      // Verificar se usuário é admin usando função has_role
      const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      if (roleError || !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado. Apenas administradores podem marcar pedidos como pagos manualmente.' }),
          { status: 403, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Parse do body
    const body = await req.json();
    const { order_id, reason, evidence } = body;
    
    // Validações
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id é obrigatório' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!isValidUUID(order_id)) {
      return new Response(
        JSON.stringify({ error: 'order_id deve ser um UUID válido' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'reason é obrigatório e deve ser uma string não vazia' }),
        { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Chamar função SQL para marcar como pago
    const { data, error } = await supabaseClient.rpc('mark_order_as_paid_manual', {
      p_order_id: order_id,
      p_reason: reason.trim(),
      p_evidence: evidence || null,
      p_admin_user_id: userId
    });
    
    if (error) {
      console.error('❌ [Admin Mark Paid] Erro ao marcar pedido como pago:', error);
      
      // Tratar erros específicos
      if (error.message?.includes('já está marcado como pago')) {
        return new Response(
          JSON.stringify({ 
            error: 'Pedido já está marcado como pago',
            message: error.message
          }),
          { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (error.message?.includes('já tem webhook válido')) {
        return new Response(
          JSON.stringify({ 
            error: 'Pedido já tem webhook válido processado',
            message: 'Não é possível marcar manualmente um pedido que já foi processado via webhook. Use o webhook para marcar como pago.',
            details: error.message
          }),
          { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (error.message?.includes('não encontrado')) {
        return new Response(
          JSON.stringify({ 
            error: 'Pedido não encontrado',
            message: error.message
          }),
          { status: 404, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao marcar pedido como pago',
          message: error.message,
          details: error
        }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Buscar pedido atualizado para retornar
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, paid_at, cakto_webhook_id, cakto_webhook_metadata')
      .eq('id', order_id)
      .single();
    
    if (orderError) {
      console.warn('⚠️ [Admin Mark Paid] Erro ao buscar pedido atualizado:', orderError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido marcado como pago com sucesso',
        order_id: order_id,
        order: order || null,
        marked_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...secureHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('❌ [Admin Mark Paid] Erro geral:', error);
    
    const { response } = createErrorResponse(
      error,
      'Erro ao processar marcação manual de pedido',
      500,
      'MARK_ORDER_PAID_ERROR'
    );
    
    return new Response(response.body, {
      ...response,
      headers: { ...secureHeaders, ...response.headers },
    });
  }
});

