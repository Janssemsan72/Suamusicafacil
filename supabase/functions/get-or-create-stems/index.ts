import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: get-or-create-stems
 * 
 * Implementa a lógica de verificar/criar separação de stems seguindo as Regras de Ouro:
 * - Verifica se já existe separação completa em stem_separations
 * - Se existir e estiver 'completed', retorna URLs
 * - Se não existir ou estiver 'pending'/'processing', verifica status na Suno
 * - Se necessário, cria nova separação
 * - Retorna status e URLs quando disponíveis
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Get or Create Stems Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Configuração do Supabase incompleta');
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    // Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = token === serviceKey;
    
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        throw new Error('Token inválido ou expirado');
      }
      
      // Verificar se é admin
      const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      if (roleError || !isAdmin) {
        throw new Error('Sem permissão de admin');
      }
    }

    // Extrair parâmetros
    const body = await req.json();
    const song_id = body.song_id;
    const audio_id = body.audio_id;

    if (!song_id && !audio_id) {
      throw new Error('song_id ou audio_id é obrigatório');
    }

    console.log('📋 Parâmetros recebidos:', { song_id, audio_id });

    // Buscar song se necessário
    let song: any = null;
    
    if (song_id) {
      const { data: songData, error: songError } = await supabaseClient
        .from('songs')
        .select('id, suno_clip_id, suno_task_id, vocals_url, instrumental_url')
        .eq('id', song_id)
        .single();
      
      if (songError || !songData) {
        throw new Error(`Song não encontrada: ${songError?.message || 'Song não existe'}`);
      }
      
      song = songData;
    } else if (audio_id) {
      const { data: songs, error: songsError } = await supabaseClient
        .from('songs')
        .select('id, suno_clip_id, suno_task_id, vocals_url, instrumental_url')
        .eq('suno_clip_id', audio_id)
        .limit(1);
      
      if (songsError || !songs || songs.length === 0) {
        throw new Error(`Song não encontrada para audio_id: ${audio_id}`);
      }
      
      song = songs[0];
    }

    console.log('✅ Song encontrada:', song.id);

    // ✅ REGRA DE OURO #3: Verificar se já existe separação completa
    const { data: existingSeparation, error: separationError } = await supabaseClient
      .from('stem_separations')
      .select('*')
      .eq('song_id', song.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSeparation && existingSeparation.instrumental_url && existingSeparation.vocal_url) {
      console.log('✅ Separação completa já existe');
      return new Response(
        JSON.stringify({
          success: true,
          status: 'completed',
          separation_id: existingSeparation.id,
          instrumental_url: existingSeparation.instrumental_url,
          vocal_url: existingSeparation.vocal_url,
          completed_at: existingSeparation.completed_at
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Verificar se há separação em processamento
    const { data: processingSeparation } = await supabaseClient
      .from('stem_separations')
      .select('*')
      .eq('song_id', song.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (processingSeparation) {
      console.log('⏳ Separação já está em processamento');
      return new Response(
        JSON.stringify({
          success: true,
          status: processingSeparation.status,
          separation_id: processingSeparation.id,
          separation_task_id: processingSeparation.separation_task_id,
          message: 'Separação já está em processamento'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Se não existe separação, criar uma nova chamando separate-audio-stems
    console.log('🔄 Criando nova separação...');
    
    const functionsBase = `${supabaseUrl}/functions/v1`;
    const separateResponse = await fetch(`${functionsBase}/separate-audio-stems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({ song_id: song.id }),
    });

    if (!separateResponse.ok) {
      const errorText = await separateResponse.text();
      throw new Error(`Erro ao iniciar separação: ${separateResponse.status} ${errorText}`);
    }

    const separateData = await separateResponse.json();
    console.log('✅ Separação iniciada:', separateData);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'pending',
        separation_id: separateData.separation_id,
        separation_task_id: separateData.separation_task_id,
        message: 'Separação iniciada com sucesso. Os resultados serão processados via callback.'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro em get-or-create-stems:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

