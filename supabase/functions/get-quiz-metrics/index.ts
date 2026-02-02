/**
 * Edge Function: get-quiz-metrics
 * 
 * Endpoint para consultar métricas de quizzes e pedidos
 * Retorna dados formatados para dashboard
 * 
 * Query params:
 * - start_date: Data inicial (YYYY-MM-DD, padrão: 30 dias atrás)
 * - end_date: Data final (YYYY-MM-DD, padrão: hoje)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  // ✅ CORREÇÃO: Aceitar tanto GET quanto POST (supabase.functions.invoke usa POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', method: req.method }),
      { status: 405, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ✅ CORREÇÃO: Verificar autenticação antes de processar
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Authentication required' }),
        { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Criar cliente Supabase para verificar token
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ [get-quiz-metrics] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar token do usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role key para consultas
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      console.error('❌ [get-quiz-metrics] Service role key não configurada');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // ✅ CORREÇÃO: Aceitar parâmetros tanto de query string (GET) quanto do body (POST)
    let startDateParam: string | null = null;
    let endDateParam: string | null = null;
    
    if (req.method === 'GET') {
      // GET: ler de query params
      const url = new URL(req.url);
      startDateParam = url.searchParams.get('start_date');
      endDateParam = url.searchParams.get('end_date');
    } else if (req.method === 'POST') {
      // POST: ler do body (supabase.functions.invoke usa POST)
      try {
        const body = await req.json();
        startDateParam = body.start_date || null;
        endDateParam = body.end_date || null;
      } catch (e) {
        // Se não conseguir parsear JSON, tentar query params como fallback
        const url = new URL(req.url);
        startDateParam = url.searchParams.get('start_date');
        endDateParam = url.searchParams.get('end_date');
      }
    }

    // Validar e converter datas
    let startDate: string;
    let endDate: string;

    if (startDateParam) {
      // Validar formato YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
        return new Response(
          JSON.stringify({ error: 'Invalid start_date format. Use YYYY-MM-DD' }),
          { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      startDate = startDateParam;
    } else {
      // Padrão: 30 dias atrás
      const date = new Date();
      date.setDate(date.getDate() - 30);
      startDate = date.toISOString().split('T')[0];
    }

    if (endDateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
        return new Response(
          JSON.stringify({ error: 'Invalid end_date format. Use YYYY-MM-DD' }),
          { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }
      endDate = endDateParam;
    } else {
      // Padrão: hoje
      endDate = new Date().toISOString().split('T')[0];
    }

    console.log('📊 [get-quiz-metrics] Consultando métricas:', { startDate, endDate });

    // Tentar RPC get_quiz_metrics primeiro; se falhar (tabela/função inexistente), usar fallback
    let data: any[] | null = null;
    const { data: rpcData, error } = await supabaseClient.rpc('get_quiz_metrics', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.warn('⚠️ [get-quiz-metrics] RPC falhou, usando fallback direto (quizzes/orders):', error.message);
      // FALLBACK: Calcular métricas diretamente de quizzes e orders
      const start = new Date(startDate + 'T00:00:00Z');
      const end = new Date(endDate + 'T23:59:59.999Z');

      const { data: quizzes } = await supabaseClient
        .from('quizzes')
        .select('id, created_at, session_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { data: orders } = await supabaseClient
        .from('orders')
        .select('id, created_at, quiz_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      let currentRetryQueue = 0;
      try {
        const { count } = await supabaseClient
          .from('quiz_retry_queue')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']);
        currentRetryQueue = count || 0;
      } catch {
        // quiz_retry_queue pode não existir
      }

      const byDay: Record<string, { quizzes: number; withSession: number; orders: number; withQuiz: number }> = {};
      const oneDayMs = 24 * 60 * 60 * 1000;
      for (let t = start.getTime(); t <= end.getTime(); t += oneDayMs) {
        const key = new Date(t).toISOString().split('T')[0];
        byDay[key] = { quizzes: 0, withSession: 0, orders: 0, withQuiz: 0 };
      }

      (quizzes || []).forEach((q: any) => {
        const key = q?.created_at?.split?.('T')?.[0];
        if (key && byDay[key]) {
          byDay[key].quizzes++;
          if (q?.session_id) byDay[key].withSession++;
        }
      });
      (orders || []).forEach((o: any) => {
        const key = o?.created_at?.split?.('T')?.[0];
        if (key && byDay[key]) {
          byDay[key].orders++;
          if (o?.quiz_id) byDay[key].withQuiz++;
        }
      });

      const todayKey = new Date().toISOString().split('T')[0];
      data = Object.entries(byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([metric_date, v]) => ({
          metric_date,
          quizzes_saved: v.quizzes,
          quizzes_saved_with_session_id: v.withSession,
          orders_created: v.orders,
          orders_with_quiz: v.withQuiz,
          orders_without_quiz: v.orders - v.withQuiz,
          quizzes_lost: 0,
          retry_queue_size: metric_date === todayKey ? currentRetryQueue : 0,
          success_rate: v.orders > 0 ? Math.round((v.withQuiz / v.orders) * 10000) / 100 : 0,
          session_id_adoption_rate: v.quizzes > 0 ? Math.round((v.withSession / v.quizzes) * 10000) / 100 : 0
        }));
    } else {
      data = rpcData || [];
    }

    // Calcular métricas agregadas
    const totalQuizzesSaved = data?.reduce((sum: number, row: any) => sum + (row.quizzes_saved || 0), 0) || 0;
    const totalOrdersCreated = data?.reduce((sum: number, row: any) => sum + (row.orders_created || 0), 0) || 0;
    const totalOrdersWithQuiz = data?.reduce((sum: number, row: any) => sum + (row.orders_with_quiz || 0), 0) || 0;
    const totalOrdersWithoutQuiz = data?.reduce((sum: number, row: any) => sum + (row.orders_without_quiz || 0), 0) || 0;

    const overallSuccessRate = totalOrdersCreated > 0
      ? Math.round((totalOrdersWithQuiz / totalOrdersCreated) * 100 * 100) / 100
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          start_date: startDate,
          end_date: endDate
        },
        daily_metrics: data || [],
        aggregated: {
          total_quizzes_saved: totalQuizzesSaved,
          total_orders_created: totalOrdersCreated,
          total_orders_with_quiz: totalOrdersWithQuiz,
          total_orders_without_quiz: totalOrdersWithoutQuiz,
          overall_success_rate: overallSuccessRate
        }
      }),
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [get-quiz-metrics] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error' 
      }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

