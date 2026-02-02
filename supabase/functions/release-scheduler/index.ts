import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSecureHeaders } from "../_shared/security-headers.ts";

function getAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }
  const errorId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    console.log(`[${errorId}] 🚀 Release scheduler iniciado`);
    const supabase = getAdmin();

    // Buscar todos os pedidos com músicas aprovadas e release_at vencido
    const now = new Date();
    const nowIso = now.toISOString();
    console.log(`[${errorId}] 📅 Buscando músicas aprovadas com release_at <= ${nowIso} (agora: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`);
    
    // Buscar músicas com status 'approved' e release_at no passado
    const { data: dueSongs, error } = await supabase
      .from('songs')
      .select('id, order_id, status, release_at, audio_url, title, variant_number')
      .eq('status', 'approved')
      .lte('release_at', nowIso)
      .not('audio_url', 'is', null)
      .is('released_at', null) // Apenas músicas ainda não liberadas
      .order('release_at', { ascending: true });

    if (error) {
      console.error(`[${errorId}] ❌ Erro ao buscar músicas:`, error);
      throw error;
    }
    
    if (!dueSongs || dueSongs.length === 0) {
      // Debug: verificar quantas músicas aprovadas existem
      const { data: allApproved, count } = await supabase
        .from('songs')
        .select('id, status, release_at', { count: 'exact', head: false })
        .eq('status', 'approved')
        .not('audio_url', 'is', null)
        .is('released_at', null);
      
      console.log(`[${errorId}] ✅ Nenhuma música pendente para liberação`);
      console.log(`[${errorId}] 📊 Debug: Existem ${count || 0} músicas aprovadas não liberadas`);
      if (allApproved && allApproved.length > 0) {
        console.log(`[${errorId}] 📊 Debug: Próximos release_at:`, 
          allApproved.map(s => ({ id: s.id, release_at: s.release_at, diff: Math.round((new Date(s.release_at).getTime() - now.getTime()) / 1000 / 60) }))
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: 'Nenhuma música pendente',
          debug: {
            totalApproved: count || 0,
            now: nowIso
          }
        }), 
        { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${errorId}] 📊 Encontradas ${dueSongs.length} músicas para liberar`);

    // Agrupar por pedido
    const byOrder = new Map<string, any[]>();
    for (const s of dueSongs) {
      if (!byOrder.has(s.order_id)) byOrder.set(s.order_id, []);
      byOrder.get(s.order_id)!.push(s);
    }

    console.log(`[${errorId}] 📦 Processando ${byOrder.size} pedidos distintos`);

    let emailsSent = 0;
    let errors = 0;
    
    for (const [orderId, songs] of byOrder.entries()) {
      try {
        console.log(`[${errorId}] 🔄 Processando pedido ${orderId} com ${songs.length} músicas`);
        
        // Marcar todas as músicas do pedido como released
        const { data: updatedSongs, error: updError } = await supabase
          .from('songs')
          .update({ 
            status: 'released', 
            released_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
          })
          .eq('order_id', orderId)
          .eq('status', 'approved')
          .select('id');
          
        if (updError) {
          console.error(`[${errorId}] ❌ Falha ao marcar released para pedido ${orderId}:`, updError);
          errors++;
          continue;
        }
        
        console.log(`[${errorId}] ✅ ${updatedSongs?.length || 0} músicas marcadas como released para pedido ${orderId}`);

        // Enviar email para a primeira música do pedido
        const first = songs.sort((a, b) => (a.id > b.id ? 1 : -1))[0];
        try {
          console.log(`[${errorId}] 📧 Enviando email para pedido ${orderId}, música ${first.id}`);
          
          // Usar supabase.functions.invoke para autenticação automática
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            'send-music-released-email',
            {
              body: { songId: first.id, orderId, force: true }
            }
          );
          
          if (emailError) {
            console.error(`[${errorId}] ❌ Email função falhou para pedido ${orderId}:`, emailError);
            errors++;
          } else {
            console.log(`[${errorId}] ✅ Email enviado com sucesso para pedido ${orderId}:`, JSON.stringify(emailResult || {}));
            emailsSent++;
          }
        } catch (e: any) {
          console.error(`[${errorId}] ❌ Erro ao chamar função de email para pedido ${orderId}:`, e);
          errors++;
        }
      } catch (e) {
        console.error(`[${errorId}] ❌ Erro ao processar pedido ${orderId}:`, e);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      processedOrders: byOrder.size,
      emailsSent,
      errors,
      durationMs: duration,
      timestamp: new Date().toISOString()
    };

    console.log(`[${errorId}] ✅ Processamento concluído:`, result);
    
    return new Response(
      JSON.stringify(result), 
      { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    const duration = Date.now() - startTime;
    console.error(`[${errorId}] ❌ release-scheduler erro após ${duration}ms:`, e);
    return new Response(
      JSON.stringify({ 
        error: e.message, 
        errorId,
        durationMs: duration,
        timestamp: new Date().toISOString()
      }), 
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
