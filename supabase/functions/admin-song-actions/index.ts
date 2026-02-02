import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getSecureHeaders } from "../_shared/security-headers.ts";

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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, songId, payload } = await req.json();

    console.log(`🎵 Admin action: ${action} on song ${songId}`);

    switch (action) {
      case 'release_now': {
        const now = new Date().toISOString();
        const { error } = await supabaseClient
          .from('songs')
          .update({
            status: 'released',
            released_at: now,
            updated_at: now
          })
          .eq('id', songId);

        if (error) throw error;

        // Log action
        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'release_song',
          target_table: 'songs',
          target_id: songId,
          changes: { status: 'released', released_at: now }
        });

        // Send release email
        try {
          const { error: emailError } = await supabaseClient.functions.invoke('send-music-released-email', {
            body: { song_id: songId }
          });
          
          if (emailError) {
            console.error('Failed to send release email:', emailError);
          } else {
            console.log('✅ Release email sent successfully');
          }
        } catch (emailError) {
          console.error('Failed to send release email:', emailError);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Song released successfully' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'postpone': {
        const { release_at } = payload;
        const { error } = await supabaseClient
          .from('songs')
          .update({
            release_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', songId);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'postpone_song',
          target_table: 'songs',
          target_id: songId,
          changes: { release_at }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Release date updated' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revert_to_ready': {
        const { error } = await supabaseClient
          .from('songs')
          .update({
            status: 'ready',
            released_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', songId);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'revert_song',
          target_table: 'songs',
          target_id: songId,
          changes: { status: 'ready', released_at: null }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Song reverted to ready' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_metadata': {
        const { title, style, emotion, lyrics } = payload;
        const updates: any = { updated_at: new Date().toISOString() };
        
        if (title) updates.title = title;
        if (style) updates.style = style;
        // Novo padrão: emotion pode ser null (tom derivado do message na geração)
        if (emotion !== undefined) updates.emotion = emotion;
        if (lyrics !== undefined) updates.lyrics = lyrics;

        const { error } = await supabaseClient
          .from('songs')
          .update(updates)
          .eq('id', songId);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'update_song_metadata',
          target_table: 'songs',
          target_id: songId,
          changes: updates
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Metadata updated' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { error } = await supabaseClient
          .from('songs')
          .delete()
          .eq('id', songId);

        if (error) throw error;

        await supabaseClient.from('admin_logs').insert({
          admin_user_id: user.id,
          action: 'delete_song',
          target_table: 'songs',
          target_id: songId
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Song deleted' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resend_email': {
        const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-music-released-email', {
          body: { song_id: songId }
        });

        if (emailError) {
          throw new Error(`Failed to send email: ${emailError.message || 'Erro desconhecido'}`);
        }

        if (emailData && typeof emailData === 'object' && 'success' in emailData && emailData.success === false) {
          throw new Error(`Failed to send email: ${(emailData as any).error || 'Operação falhou'}`);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Email sent' }),
          { status: 200, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('❌ Error in admin-song-actions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...secureHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
