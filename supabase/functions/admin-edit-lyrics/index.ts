import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Headers simplificados
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
    console.log('=== Admin Edit Lyrics Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ CORREÇÃO: Parsing resiliente do body
    let approval_id: string | null = null;
    let lyrics: any = null;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        approval_id = (body && body.approval_id) || null;
        lyrics = (body && body.lyrics) || null;
      } else {
        const raw = await req.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            approval_id = parsed.approval_id || null;
            lyrics = parsed.lyrics || null;
          } catch (_) {
            const url = new URL(req.url);
            approval_id = url.searchParams.get('approval_id');
            // lyrics não pode vir via querystring, então fica null
          }
        } else {
          const url = new URL(req.url);
          approval_id = url.searchParams.get('approval_id');
        }
      }
    } catch (parseError) {
      console.error('❌ [AdminEditLyrics] Erro ao fazer parse do body:', parseError);
      try {
        const url = new URL(req.url);
        approval_id = url.searchParams.get('approval_id');
      } catch (_) {
        // Ignorar
      }
    }

    if (!approval_id) {
      throw new Error('approval_id é obrigatório');
    }

    if (!lyrics) {
      throw new Error('lyrics é obrigatório');
    }

    console.log('📝 Editando letra:', approval_id);

    // 1. Buscar aprovação atual
    const { data: approval, error: approvalError } = await supabaseClient
      .from('lyrics_approvals')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approval) {
      throw new Error(`Aprovação não encontrada: ${approvalError?.message}`);
    }

    // ✅ CORREÇÃO: Função para sanitizar sequências de escape Unicode inválidas
    const sanitizeUnicodeEscapes = (text: string): string => {
      if (typeof text !== 'string') {
        return String(text);
      }
      
      return text
        // Corrigir \u seguido de menos de 4 caracteres hexadecimais
        .replace(/\\u([0-9a-fA-F]{0,3})(?![0-9a-fA-F])/g, (match, hex) => {
          if (hex.length < 4) {
            const padded = hex.padEnd(4, '0');
            return `\\u${padded}`;
          }
          return match;
        })
        // Corrigir \u seguido de caracteres não-hexadecimais (remover o \u)
        .replace(/\\u([^0-9a-fA-F])/g, '$1')
        // Corrigir \u no final da string (remover)
        .replace(/\\u$/g, '')
        // Corrigir \u seguido de espaço ou quebra de linha (remover o \u)
        .replace(/\\u(\s)/g, '$1')
        // Garantir que \u válidos sejam mantidos (4 dígitos hexadecimais)
        .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
          const code = parseInt(hex, 16);
          if (code >= 0 && code <= 0x10FFFF) {
            return match;
          }
          return '';
        });
    };

    const sanitizeLyricsText = (lyrics: string): string => {
      if (typeof lyrics !== 'string') {
        return String(lyrics);
      }
      
      let sanitized = sanitizeUnicodeEscapes(lyrics);
      // Remover caracteres de controle (exceto \n, \r, \t)
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      // Normalizar quebras de linha
      sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      return sanitized;
    };

    // 2. Validar que a estrutura de lyrics está correta
    let lyricsToSave: any;
    let lyricsPreview: string;

    // Se lyrics for string (formato novo), converter para JSON
    if (typeof lyrics === 'string') {
      // ✅ CORREÇÃO: Sanitizar texto antes de salvar
      const sanitizedLyrics = sanitizeLyricsText(lyrics);
      
      // Formato: string com [Verse], [Chorus], etc.
      lyricsToSave = {
        title: approval.lyrics?.title || 'Música Personalizada',
        lyrics: sanitizedLyrics,
        style: approval.lyrics?.style || 'pop',
        language: approval.lyrics?.language || 'pt',
        tone: approval.lyrics?.tone || 'emotional'
      };
      lyricsPreview = sanitizedLyrics.substring(0, 200) + (sanitizedLyrics.length > 200 ? '...' : '');
    } else if (typeof lyrics === 'object') {
      // Formato: objeto com { title, lyrics, verses, etc. }
      // ✅ CORREÇÃO: Sanitizar strings dentro do objeto
      lyricsToSave = { ...lyrics };
      
      // Sanitizar campo lyrics se for string
      if (typeof lyricsToSave.lyrics === 'string') {
        lyricsToSave.lyrics = sanitizeLyricsText(lyricsToSave.lyrics);
      }
      
      // Sanitizar verses se existir
      if (lyricsToSave.verses && Array.isArray(lyricsToSave.verses)) {
        lyricsToSave.verses = lyricsToSave.verses.map((verse: any) => {
          if (verse && typeof verse.text === 'string') {
            return { ...verse, text: sanitizeLyricsText(verse.text) };
          }
          return verse;
        });
      }
      
      // Gerar preview do título e primeira linha
      if (lyrics.title && lyrics.lyrics) {
        const previewText = typeof lyrics.lyrics === 'string' ? lyrics.lyrics : '';
        lyricsPreview = `${lyrics.title} - ${previewText.substring(0, 150)}${previewText.length > 150 ? '...' : ''}`;
      } else if (lyrics.verses && Array.isArray(lyrics.verses) && lyrics.verses.length > 0) {
        const firstVerse = lyrics.verses[0]?.text || '';
        lyricsPreview = `${lyrics.title || 'Música Personalizada'} - ${firstVerse.substring(0, 150)}${firstVerse.length > 150 ? '...' : ''}`;
      } else {
        lyricsPreview = approval.lyrics_preview || 'Letra editada';
      }
    } else {
      throw new Error('Formato de lyrics inválido');
    }

    // 3. Atualizar aprovação com novas letras
    const { error: updateError } = await supabaseClient
      .from('lyrics_approvals')
      .update({
        lyrics: lyricsToSave,
        lyrics_preview: lyricsPreview,
        updated_at: new Date().toISOString()
      })
      .eq('id', approval_id);

    if (updateError) {
      throw new Error(`Erro ao atualizar letra: ${updateError.message}`);
    }

    // 4. Atualizar também o job se existir
    if (approval.job_id) {
      await supabaseClient
        .from('jobs')
        .update({
          gpt_lyrics: lyricsToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.job_id);
    }

    // 5. Log da ação
    try {
      await supabaseClient.from('admin_logs').insert({
        action: 'lyrics_edited',
        target_table: 'lyrics_approvals',
        target_id: approval_id,
        details: {
          approval_id: approval_id,
          job_id: approval.job_id,
          order_id: approval.order_id,
          previous_lyrics_preview: approval.lyrics_preview,
          new_lyrics_preview: lyricsPreview
        }
      });
    } catch (logError) {
      console.warn('⚠️ Erro ao registrar log (não crítico):', logError);
    }

    console.log('✅ Letra editada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Letra editada com sucesso',
        approval_id: approval_id
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in admin-edit-lyrics:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido ao editar letra',
        details: error.details || null
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});


