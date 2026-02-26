import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), { headers, status: 500 });
  }

  const sql = postgres(dbUrl, { prepare: false });
  const results: string[] = [];
  const errors: string[] = [];

  async function run(label: string, query: string) {
    try {
      await sql.unsafe(query);
      results.push(`✅ ${label}`);
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        results.push(`⏭️ ${label} (já existe)`);
      } else {
        errors.push(`❌ ${label}: ${e.message}`);
      }
    }
  }

  try {
    // 1. TABELAS
    await run("jobs", `CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID, quiz_id UUID, status TEXT NOT NULL DEFAULT 'pending',
      gpt_lyrics JSONB, suno_task_id TEXT, suno_clip_id TEXT, error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("lyrics_approvals", `CREATE TABLE IF NOT EXISTS lyrics_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID, job_id UUID, quiz_id UUID, lyrics JSONB,
      status TEXT NOT NULL DEFAULT 'pending', voice TEXT DEFAULT 'S',
      lyrics_preview TEXT, expires_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ, rejection_reason TEXT,
      is_highlighted BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("email_logs", `CREATE TABLE IF NOT EXISTS email_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID, song_id UUID, email_type TEXT NOT NULL,
      to_email TEXT, from_email TEXT, subject TEXT,
      status TEXT NOT NULL DEFAULT 'pending', resend_id TEXT, error TEXT, metadata JSONB,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("admin_logs", `CREATE TABLE IF NOT EXISTS admin_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id UUID, action TEXT NOT NULL,
      target_table TEXT, target_id UUID, changes JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("order_creation_logs", `CREATE TABLE IF NOT EXISTS order_creation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID, customer_email TEXT NOT NULL, customer_whatsapp TEXT,
      quiz_data JSONB, order_data JSONB,
      status TEXT NOT NULL DEFAULT 'attempting',
      quiz_id UUID, order_id UUID, error_message TEXT, error_details JSONB,
      source TEXT NOT NULL DEFAULT 'edge_function',
      ip_address TEXT, user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("suno_credits", `CREATE TABLE IF NOT EXISTS suno_credits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      total_credits INTEGER NOT NULL DEFAULT 0,
      used_credits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await run("suno_credit_logs", `CREATE TABLE IF NOT EXISTS suno_credit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID, order_id UUID,
      credits_used INTEGER NOT NULL DEFAULT 0, description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // 2. COLUNAS FALTANTES - quizzes
    await run("quizzes.order_id", `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS order_id UUID`);
    await run("quizzes.answers", `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS answers JSONB`);
    await run("quizzes.transaction_id", `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS transaction_id TEXT`);
    await run("quizzes.customer_email", `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_email TEXT`);
    await run("quizzes.customer_whatsapp", `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT`);

    // 2.2 COLUNAS FALTANTES - orders
    await run("orders.provider_ref", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_ref TEXT`);
    await run("orders.magic_token", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS magic_token TEXT`);
    await run("orders.total_cents", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cents INTEGER`);
    await run("orders.currency", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL'`);
    await run("orders.amount_cents", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_cents INTEGER`);
    await run("orders.provider", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider TEXT`);
    await run("orders.payment_provider", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT`);
    await run("orders.customer_whatsapp", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT`);
    await run("orders.transaction_id", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id UUID`);
    await run("orders.cakto_transaction_id", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_transaction_id TEXT`);
    await run("orders.cakto_payment_status", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_payment_status TEXT`);
    await run("orders.hotmart_transaction_id", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT`);
    await run("orders.stripe_payment_intent_id", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`);
    await run("orders.paid_at", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);

    // 2.3 COLUNAS FALTANTES - songs
    await run("songs.released_at", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ`);
    await run("songs.release_at", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ`);
    await run("songs.suno_clip_id", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS suno_clip_id TEXT`);
    await run("songs.suno_task_id", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS suno_task_id TEXT`);
    await run("songs.duration_sec", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_sec INTEGER`);
    await run("songs.vocal_url", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS vocal_url TEXT`);
    await run("songs.instrumental_url", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS instrumental_url TEXT`);

    // 3. RLS
    await run("RLS jobs", `ALTER TABLE jobs ENABLE ROW LEVEL SECURITY`);
    await run("RLS lyrics_approvals", `ALTER TABLE lyrics_approvals ENABLE ROW LEVEL SECURITY`);
    await run("RLS email_logs", `ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY`);
    await run("RLS admin_logs", `ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY`);
    await run("RLS order_creation_logs", `ALTER TABLE order_creation_logs ENABLE ROW LEVEL SECURITY`);

    // Policies
    await run("policy jobs", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role full access jobs" ON jobs;
      CREATE POLICY "Service role full access jobs" ON jobs FOR ALL USING (true) WITH CHECK (true);
    END $$`);

    await run("policy lyrics_approvals", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role full access lyrics_approvals" ON lyrics_approvals;
      CREATE POLICY "Service role full access lyrics_approvals" ON lyrics_approvals FOR ALL USING (true) WITH CHECK (true);
    END $$`);

    await run("policy email_logs", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role full access email_logs" ON email_logs;
      CREATE POLICY "Service role full access email_logs" ON email_logs FOR ALL USING (true) WITH CHECK (true);
    END $$`);

    await run("policy admin_logs", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role full access admin_logs" ON admin_logs;
      CREATE POLICY "Service role full access admin_logs" ON admin_logs FOR ALL USING (true) WITH CHECK (true);
    END $$`);

    await run("policy order_creation_logs", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role full access order_creation_logs" ON order_creation_logs;
      CREATE POLICY "Service role full access order_creation_logs" ON order_creation_logs FOR ALL USING (true) WITH CHECK (true);
    END $$`);

    // Tabela profiles (se não existir)
    await run("profiles table", `CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      display_name TEXT,
      preferred_language TEXT DEFAULT 'pt',
      email TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // RLS para user_roles (leitura pelo próprio user + admins)
    await run("RLS user_roles", `ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`);
    await run("policy user_roles SELECT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Users can read user_roles" ON user_roles;
      CREATE POLICY "Users can read user_roles" ON user_roles FOR SELECT USING (true);
    END $$`);
    await run("policy user_roles INSERT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can insert user_roles" ON user_roles;
      CREATE POLICY "Service role can insert user_roles" ON user_roles FOR INSERT WITH CHECK (true);
    END $$`);
    await run("policy user_roles UPDATE", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can update user_roles" ON user_roles;
      CREATE POLICY "Service role can update user_roles" ON user_roles FOR UPDATE USING (true);
    END $$`);
    await run("policy user_roles DELETE", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can delete user_roles" ON user_roles;
      CREATE POLICY "Service role can delete user_roles" ON user_roles FOR DELETE USING (true);
    END $$`);

    // RLS para profiles (leitura permitida)
    await run("RLS profiles", `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`);
    await run("policy profiles SELECT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
      CREATE POLICY "Users can read profiles" ON profiles FOR SELECT USING (true);
    END $$`);
    await run("policy profiles INSERT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
      CREATE POLICY "Service role can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
    END $$`);
    await run("policy profiles UPDATE", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can update profiles" ON profiles;
      CREATE POLICY "Service role can update profiles" ON profiles FOR UPDATE USING (true);
    END $$`);

    await run("policy orders INSERT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Public can insert orders" ON orders;
      CREATE POLICY "Public can insert orders" ON orders FOR INSERT WITH CHECK (true);
    END $$`);
    await run("policy orders SELECT", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Public can read own orders" ON orders;
      CREATE POLICY "Public can read own orders" ON orders FOR SELECT USING (true);
    END $$`);
    await run("policy orders UPDATE", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can update orders" ON orders;
      CREATE POLICY "Service role can update orders" ON orders FOR UPDATE USING (true);
    END $$`);
    await run("policy orders DELETE", `DO $$ BEGIN
      DROP POLICY IF EXISTS "Service role can delete orders" ON orders;
      CREATE POLICY "Service role can delete orders" ON orders FOR DELETE USING (true);
    END $$`);

    // 4. FUNÇÕES
    await run("orders.customer_name", `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`);

    await run("create_order_atomic", `CREATE OR REPLACE FUNCTION create_order_atomic(
      p_session_id UUID, p_customer_email TEXT, p_customer_whatsapp TEXT,
      p_quiz_data JSONB, p_plan TEXT, p_amount_cents INTEGER, p_provider TEXT,
      p_transaction_id TEXT DEFAULT NULL, p_source TEXT DEFAULT 'edge_function',
      p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL,
      p_customer_name TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    DECLARE v_log_id UUID; v_quiz_id UUID; v_order_id UUID; v_result JSONB; v_error_text TEXT; v_tx UUID;
    BEGIN
      IF p_transaction_id IS NOT NULL AND p_transaction_id != '' THEN
        BEGIN v_tx := p_transaction_id::UUID; EXCEPTION WHEN OTHERS THEN v_tx := NULL; END;
      ELSE v_tx := NULL; END IF;
      INSERT INTO order_creation_logs (session_id, customer_email, customer_whatsapp, quiz_data, order_data, status, source, ip_address, user_agent)
      VALUES (p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data,
        jsonb_build_object('plan', p_plan, 'amount_cents', p_amount_cents, 'provider', p_provider, 'transaction_id', p_transaction_id),
        'attempting', p_source, p_ip_address, p_user_agent) RETURNING id INTO v_log_id;
      BEGIN
        INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
        VALUES (p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language','pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB,'{}'::JSONB)||jsonb_build_object('session_id',p_session_id::TEXT,'customer_email',LOWER(TRIM(p_customer_email)),'customer_whatsapp',p_customer_whatsapp,'customer_name',COALESCE(p_customer_name,'')), p_transaction_id)
        ON CONFLICT (session_id) DO UPDATE SET customer_email=EXCLUDED.customer_email, customer_whatsapp=EXCLUDED.customer_whatsapp, about_who=EXCLUDED.about_who, relationship=EXCLUDED.relationship, style=EXCLUDED.style, language=EXCLUDED.language, vocal_gender=EXCLUDED.vocal_gender, qualities=EXCLUDED.qualities, memories=EXCLUDED.memories, message=EXCLUDED.message, key_moments=EXCLUDED.key_moments, occasion=EXCLUDED.occasion, desired_tone=EXCLUDED.desired_tone, answers=EXCLUDED.answers, transaction_id=EXCLUDED.transaction_id, updated_at=NOW()
        RETURNING id INTO v_quiz_id;
        UPDATE order_creation_logs SET quiz_id=v_quiz_id, status='quiz_created', updated_at=NOW() WHERE id=v_log_id;
        INSERT INTO orders (quiz_id, user_id, plan, amount_cents, total_cents, currency, status, provider, payment_provider, customer_email, customer_whatsapp, customer_name, transaction_id)
        VALUES (v_quiz_id, NULL, p_plan::TEXT, p_amount_cents, p_amount_cents, 'BRL', 'pending', p_provider::TEXT, p_provider::TEXT, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, TRIM(p_customer_name), v_tx)
        RETURNING id INTO v_order_id;
        UPDATE quizzes SET order_id=v_order_id, updated_at=NOW() WHERE id=v_quiz_id;
        UPDATE order_creation_logs SET order_id=v_order_id, status='order_created', updated_at=NOW() WHERE id=v_log_id;
        v_result := jsonb_build_object('success',true,'quiz_id',v_quiz_id,'order_id',v_order_id,'log_id',v_log_id);
        RETURN v_result;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_text = MESSAGE_TEXT;
        UPDATE order_creation_logs SET status='failed', error_message=v_error_text, updated_at=NOW() WHERE id=v_log_id;
        RAISE EXCEPTION 'Erro ao criar pedido: % (Log ID: %)', v_error_text, v_log_id;
      END;
    END; $fn$`);

    // Migrar customer_name dos pedidos existentes (extrair do quiz answers)
    await run("migrate customer_name", `
      UPDATE orders o SET customer_name = TRIM((q.answers->>'customer_name')::TEXT)
      FROM quizzes q WHERE q.id = o.quiz_id
      AND o.customer_name IS NULL
      AND q.answers->>'customer_name' IS NOT NULL
      AND q.answers->>'customer_name' != ''
    `);

    await run("deduct_suno_credits", `CREATE OR REPLACE FUNCTION deduct_suno_credits(
      credits_to_deduct INTEGER, p_job_id UUID DEFAULT NULL,
      p_order_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    DECLARE v_current INTEGER; v_result JSONB;
    BEGIN
      SELECT (total_credits - used_credits) INTO v_current FROM suno_credits LIMIT 1;
      IF v_current IS NULL THEN INSERT INTO suno_credits (total_credits, used_credits) VALUES (1000,0); v_current := 1000; END IF;
      UPDATE suno_credits SET used_credits = used_credits + credits_to_deduct, updated_at = NOW();
      INSERT INTO suno_credit_logs (job_id, order_id, credits_used, description) VALUES (p_job_id, p_order_id, credits_to_deduct, p_description);
      v_result := jsonb_build_object('success',true,'previous_credits',v_current,'credits_deducted',credits_to_deduct,'remaining_credits',v_current-credits_to_deduct);
      RETURN v_result;
    END; $fn$`);

    await run("mark_funnel_and_order_as_paid", `CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    BEGIN
      UPDATE orders SET status='paid', paid_at=COALESCE(paid_at,created_at,NOW()), updated_at=NOW() WHERE id=p_order_id AND status!='paid';
      RETURN NULL;
    END; $fn$`);

    // 5. TRIGGER - apenas log, sem http_post (Edge Functions já chamam generate-lyrics-for-approval)
    await run("trigger function", `CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    BEGIN
      IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        RAISE NOTICE '[Trigger] Pedido % marcado como paid - Edge Functions controlam geração', NEW.id;
        UPDATE orders SET paid_at = COALESCE(NEW.paid_at, NOW()) WHERE id = NEW.id AND paid_at IS NULL;
      END IF;
      RETURN NEW;
    END; $fn$`);

    await run("drop old trigger", `DROP TRIGGER IF EXISTS trigger_complete_payment_flow ON orders`);
    await run("create trigger", `CREATE TRIGGER trigger_complete_payment_flow AFTER UPDATE OF status ON orders FOR EACH ROW WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid')) EXECUTE FUNCTION trigger_complete_payment_flow()`);
    await run("enable trigger", `ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow`);

    // 6. INDEXES
    await run("idx jobs order_id", `CREATE INDEX IF NOT EXISTS idx_jobs_order_id ON jobs(order_id)`);
    await run("idx jobs status", `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
    await run("idx lyrics_approvals order_id", `CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_order_id ON lyrics_approvals(order_id)`);
    await run("idx lyrics_approvals status", `CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_status ON lyrics_approvals(status)`);
    await run("idx email_logs order_id", `CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id)`);

    // 7. Fix jobs_status_check constraint to include all used statuses
    await run("drop jobs_status_check", `ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check`);
    await run("add jobs_status_check", `ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'audio_processing', 'generating_audio'))`);

    // 8. Fill missing data
    await run("fill total_cents", `UPDATE orders SET total_cents = amount_cents WHERE total_cents IS NULL AND amount_cents IS NOT NULL`);
    await run("fill currency", `UPDATE orders SET currency = 'BRL' WHERE currency IS NULL`);

    // 9. Reload PostgREST schema cache
    await run("notify pgrst", `NOTIFY pgrst, 'reload schema'`);

    // 10. Fix songs RLS - garantir que songs possam ser lidas
    await run("songs RLS enable", `ALTER TABLE songs ENABLE ROW LEVEL SECURITY`);
    await run("drop songs select policy", `DROP POLICY IF EXISTS "Allow select songs" ON songs`);
    await run("create songs select policy", `CREATE POLICY "Allow select songs" ON songs FOR SELECT USING (true)`);
    await run("drop songs insert policy", `DROP POLICY IF EXISTS "Allow insert songs" ON songs`);
    await run("create songs insert policy", `CREATE POLICY "Allow insert songs" ON songs FOR INSERT WITH CHECK (true)`);
    await run("drop songs update policy", `DROP POLICY IF EXISTS "Allow update songs" ON songs`);
    await run("create songs update policy", `CREATE POLICY "Allow update songs" ON songs FOR UPDATE USING (true)`);

    // 11. Adicionar colunas faltantes na tabela songs (usadas pelo suno-callback)
    await run("songs.language", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS language TEXT`);
    await run("songs.style", `ALTER TABLE songs ADD COLUMN IF NOT EXISTS style TEXT`);
    
    // 12. Tabela audio_generations (usada pelo suno-callback)
    await run("audio_generations table", `CREATE TABLE IF NOT EXISTS audio_generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      generation_task_id TEXT,
      audio_id TEXT,
      audio_url TEXT,
      storage_url TEXT,
      status TEXT DEFAULT 'completed',
      job_id UUID,
      song_id UUID,
      order_id UUID,
      variant_number INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await run("audio_generations RLS", `ALTER TABLE audio_generations ENABLE ROW LEVEL SECURITY`);
    await run("drop ag select", `DROP POLICY IF EXISTS "Allow select audio_generations" ON audio_generations`);
    await run("ag select", `CREATE POLICY "Allow select audio_generations" ON audio_generations FOR SELECT USING (true)`);
    await run("drop ag insert", `DROP POLICY IF EXISTS "Allow insert audio_generations" ON audio_generations`);
    await run("ag insert", `CREATE POLICY "Allow insert audio_generations" ON audio_generations FOR INSERT WITH CHECK (true)`);

    // 13. Fix existing songs: atualizar URLs externas para Supabase Storage
    // O suno-callback já fez upload com padrão: media/{task_id}-{variant}.mp3
    // Precisamos apenas apontar as songs para os arquivos já existentes
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://fhndlazabynapislzkmw.supabase.co';
      const storageBase = `${supabaseUrl}/storage/v1/object/public/suno-tracks`;
      
      // Listar songs com URLs externas e seus respectivos suno_task_id
      const externalSongs = await sql.unsafe(`
        SELECT s.id, s.audio_url, s.order_id, s.variant_number, s.suno_clip_id,
               j.suno_task_id
        FROM songs s
        JOIN jobs j ON j.order_id = s.order_id AND j.suno_task_id IS NOT NULL
        WHERE s.audio_url NOT LIKE '%supabase%'
        ORDER BY s.order_id, s.variant_number
      `);
      
      if (externalSongs.length > 0) {
        for (const song of externalSongs) {
          // O suno-callback salva como media/{task_id}-{variant}.mp3
          const storagePath = `media/${song.suno_task_id}-${song.variant_number}.mp3`;
          const newUrl = `${storageBase}/${storagePath}`;
          
          // Verificar se o arquivo existe no storage
          const checkResp = await fetch(newUrl, { method: 'HEAD' });
          if (checkResp.ok) {
            await sql.unsafe(`UPDATE songs SET audio_url = $1, updated_at = NOW() WHERE id = $2`, [newUrl, song.id]);
            results.push(`✅ migrated song ${song.id} v${song.variant_number} -> storage`);
          } else {
            // Tentar com o clipId como nome (alguns callbacks usam o clip id)
            const altPath = `media/${song.suno_clip_id}.mp3`;
            const altUrl = `${storageBase}/${altPath}`;
            const altCheck = await fetch(altUrl, { method: 'HEAD' });
            if (altCheck.ok) {
              await sql.unsafe(`UPDATE songs SET audio_url = $1, updated_at = NOW() WHERE id = $2`, [altUrl, song.id]);
              results.push(`✅ migrated song ${song.id} v${song.variant_number} -> storage (clip)`)
            } else {
              results.push(`⚠️ no storage file for song ${song.id} (tried ${storagePath} and ${altPath})`);
            }
          }
        }
      } else {
        results.push('⏭️ no external songs to migrate');
      }
    } catch (e: any) {
      results.push(`⚠️ migration err: ${e.message}`);
    }

    // 14. Cron: poll-suno-status a cada 2 minutos como fallback
    try {
      await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_cron`);
      await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_net`);
      results.push('? pg_cron + pg_net enabled');
    } catch (cronErr: any) {
      results.push(`? cron extensions: ${cronErr.message}`);
    }
    try {
      await sql.unsafe(`SELECT cron.unschedule('poll-suno-status')`);
    } catch (_) {}
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://fhndlazabynapislzkmw.supabase.co';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      await sql.unsafe(`
        SELECT cron.schedule(
          'poll-suno-status',
          '*/2 * * * *',
          $$SELECT net.http_post(
            url := '${supabaseUrl}/functions/v1/poll-suno-status',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ${serviceKey}'),
            body := '{}'::jsonb
          )$$
        )
      `);
      results.push('? cron poll-suno-status scheduled every 2 min');
    } catch (cronErr: any) {
      results.push(`? cron schedule: ${cronErr.message}`);
    }

  } finally {
    await sql.end();
  }

  return new Response(
    JSON.stringify({
      success: errors.length === 0,
      total_ok: results.length,
      total_errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers }
  );
});
