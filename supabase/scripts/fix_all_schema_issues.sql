-- ==========================================
-- SCRIPT CONSOLIDADO: Criar TODAS as tabelas e colunas faltantes
-- Execute no Supabase Dashboard > SQL Editor
-- ==========================================

-- =====================
-- 1. TABELAS FUNDAMENTAIS
-- =====================

-- 1.1 jobs (geração de letras/áudio)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  quiz_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  gpt_lyrics JSONB,
  suno_task_id TEXT,
  suno_clip_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_order_id ON jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quiz_id ON jobs(quiz_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- 1.2 lyrics_approvals (registro de letras - auto-aprovadas no novo fluxo)
CREATE TABLE IF NOT EXISTS lyrics_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  job_id UUID,
  quiz_id UUID,
  lyrics JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  voice TEXT DEFAULT 'S',
  lyrics_preview TEXT,
  expires_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_order_id ON lyrics_approvals(order_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_job_id ON lyrics_approvals(job_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_approvals_status ON lyrics_approvals(status);

-- 1.3 email_logs (registro de emails enviados)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  song_id UUID,
  email_type TEXT NOT NULL,
  to_email TEXT,
  from_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resend_id TEXT,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- 1.4 admin_logs (registro de ações admin)
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_table, target_id);

-- 1.5 order_creation_logs (proteção de criação de pedidos)
CREATE TABLE IF NOT EXISTS order_creation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  quiz_data JSONB,
  order_data JSONB,
  status TEXT NOT NULL DEFAULT 'attempting',
  quiz_id UUID,
  order_id UUID,
  error_message TEXT,
  error_details JSONB,
  source TEXT NOT NULL DEFAULT 'edge_function',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6 suno_credits (controle de créditos Suno)
CREATE TABLE IF NOT EXISTS suno_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 suno_credit_logs (log de uso de créditos)
CREATE TABLE IF NOT EXISTS suno_credit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  order_id UUID,
  credits_used INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 2. COLUNAS FALTANTES
-- =====================

-- 2.1 quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS answers JSONB;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;

-- 2.2 orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS magic_token TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cakto_payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE orders SET total_cents = amount_cents WHERE total_cents IS NULL AND amount_cents IS NOT NULL;
UPDATE orders SET total_cents = 3700 WHERE total_cents IS NULL;
UPDATE orders SET currency = 'BRL' WHERE currency IS NULL;

-- 2.3 songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS suno_clip_id TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS suno_task_id TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_sec INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS vocal_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS instrumental_url TEXT;

-- =====================
-- 3. RLS POLICIES (idempotente)
-- =====================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyrics_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_creation_logs ENABLE ROW LEVEL SECURITY;

-- jobs
DROP POLICY IF EXISTS "Service role full access jobs" ON jobs;
CREATE POLICY "Service role full access jobs" ON jobs FOR ALL USING (true) WITH CHECK (true);

-- lyrics_approvals
DROP POLICY IF EXISTS "Service role full access lyrics_approvals" ON lyrics_approvals;
CREATE POLICY "Service role full access lyrics_approvals" ON lyrics_approvals FOR ALL USING (true) WITH CHECK (true);

-- email_logs
DROP POLICY IF EXISTS "Service role full access email_logs" ON email_logs;
CREATE POLICY "Service role full access email_logs" ON email_logs FOR ALL USING (true) WITH CHECK (true);

-- admin_logs
DROP POLICY IF EXISTS "Service role full access admin_logs" ON admin_logs;
CREATE POLICY "Service role full access admin_logs" ON admin_logs FOR ALL USING (true) WITH CHECK (true);

-- order_creation_logs
DROP POLICY IF EXISTS "Service role full access order_creation_logs" ON order_creation_logs;
CREATE POLICY "Service role full access order_creation_logs" ON order_creation_logs FOR ALL USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
CREATE POLICY "Public can insert orders" ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can read own orders" ON orders;
CREATE POLICY "Public can read own orders" ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can update orders" ON orders;
CREATE POLICY "Service role can update orders" ON orders FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Service role can delete orders" ON orders;
CREATE POLICY "Service role can delete orders" ON orders FOR DELETE USING (true);

-- quizzes
DROP POLICY IF EXISTS "Public can insert quizzes" ON quizzes;
CREATE POLICY "Public can insert quizzes" ON quizzes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can read quizzes" ON quizzes;
CREATE POLICY "Public can read quizzes" ON quizzes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can update quizzes" ON quizzes;
CREATE POLICY "Public can update quizzes" ON quizzes FOR UPDATE USING (true);

-- =====================
-- 4. FUNÇÃO create_order_atomic
-- =====================

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_session_id UUID,
  p_customer_email TEXT,
  p_customer_whatsapp TEXT,
  p_quiz_data JSONB,
  p_plan TEXT,
  p_amount_cents INTEGER,
  p_provider TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'edge_function',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_quiz_id UUID;
  v_order_id UUID;
  v_result JSONB;
  v_error_text TEXT;
  v_transaction_id_uuid UUID;
BEGIN
  IF p_transaction_id IS NOT NULL AND p_transaction_id != '' THEN
    BEGIN
      v_transaction_id_uuid := p_transaction_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_transaction_id_uuid := NULL;
    END;
  ELSE
    v_transaction_id_uuid := NULL;
  END IF;

  INSERT INTO order_creation_logs (
    session_id, customer_email, customer_whatsapp, quiz_data, order_data,
    status, source, ip_address, user_agent
  ) VALUES (
    p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data,
    jsonb_build_object('plan', p_plan, 'amount_cents', p_amount_cents, 'provider', p_provider, 'transaction_id', p_transaction_id),
    'attempting', p_source, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;

  BEGIN
    IF p_session_id IS NOT NULL THEN
      SELECT id INTO v_quiz_id FROM quizzes WHERE session_id = p_session_id AND order_id IS NOT NULL LIMIT 1;

      IF v_quiz_id IS NOT NULL THEN
        INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
        VALUES (NULL, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('session_id', p_session_id::TEXT, 'customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
        RETURNING id INTO v_quiz_id;
      ELSE
        INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
        VALUES (p_session_id, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('session_id', p_session_id::TEXT, 'customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
        ON CONFLICT (session_id) DO UPDATE SET customer_email = EXCLUDED.customer_email, customer_whatsapp = EXCLUDED.customer_whatsapp, about_who = EXCLUDED.about_who, relationship = EXCLUDED.relationship, style = EXCLUDED.style, language = EXCLUDED.language, vocal_gender = EXCLUDED.vocal_gender, qualities = EXCLUDED.qualities, memories = EXCLUDED.memories, message = EXCLUDED.message, key_moments = EXCLUDED.key_moments, occasion = EXCLUDED.occasion, desired_tone = EXCLUDED.desired_tone, answers = EXCLUDED.answers, transaction_id = EXCLUDED.transaction_id, updated_at = NOW()
        RETURNING id INTO v_quiz_id;
      END IF;
    ELSE
      INSERT INTO quizzes (session_id, customer_email, customer_whatsapp, about_who, relationship, style, language, vocal_gender, qualities, memories, message, key_moments, occasion, desired_tone, answers, transaction_id)
      VALUES (NULL, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, p_quiz_data->>'about_who', (p_quiz_data->>'relationship')::TEXT, p_quiz_data->>'style', COALESCE(p_quiz_data->>'language', 'pt'), (p_quiz_data->>'vocal_gender')::TEXT, (p_quiz_data->>'qualities')::JSONB, (p_quiz_data->>'memories')::JSONB, (p_quiz_data->>'message')::TEXT, (p_quiz_data->>'key_moments')::JSONB, (p_quiz_data->>'occasion')::TEXT, (p_quiz_data->>'desired_tone')::TEXT, COALESCE((p_quiz_data->>'answers')::JSONB, '{}'::JSONB) || jsonb_build_object('customer_email', LOWER(TRIM(p_customer_email)), 'customer_whatsapp', p_customer_whatsapp), p_transaction_id)
      RETURNING id INTO v_quiz_id;
    END IF;

    UPDATE order_creation_logs SET quiz_id = v_quiz_id, status = 'quiz_created', updated_at = NOW() WHERE id = v_log_id;

    INSERT INTO orders (quiz_id, user_id, plan, amount_cents, total_cents, currency, status, provider, payment_provider, customer_email, customer_whatsapp, transaction_id)
    VALUES (v_quiz_id, NULL, p_plan::TEXT, p_amount_cents, p_amount_cents, 'BRL', 'pending', p_provider::TEXT, p_provider::TEXT, LOWER(TRIM(p_customer_email)), p_customer_whatsapp, v_transaction_id_uuid)
    RETURNING id INTO v_order_id;

    UPDATE quizzes SET order_id = v_order_id, updated_at = NOW() WHERE id = v_quiz_id;
    UPDATE order_creation_logs SET order_id = v_order_id, status = 'order_created', updated_at = NOW() WHERE id = v_log_id;

    v_result := jsonb_build_object('success', true, 'quiz_id', v_quiz_id, 'order_id', v_order_id, 'log_id', v_log_id);
    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_text = MESSAGE_TEXT;
    UPDATE order_creation_logs SET status = 'failed', error_message = v_error_text, error_details = jsonb_build_object('sqlstate', SQLSTATE, 'error_code', SQLERRM), updated_at = NOW() WHERE id = v_log_id;
    RAISE EXCEPTION 'Erro ao criar pedido: % (Log ID: %)', v_error_text, v_log_id;
  END;
END;
$$;

-- =====================
-- 5. FUNÇÃO deduct_suno_credits (usada por generate-lyrics-for-approval)
-- =====================

CREATE OR REPLACE FUNCTION deduct_suno_credits(
  credits_to_deduct INTEGER,
  p_job_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_result JSONB;
BEGIN
  SELECT (total_credits - used_credits) INTO v_current_credits FROM suno_credits LIMIT 1;
  
  IF v_current_credits IS NULL THEN
    INSERT INTO suno_credits (total_credits, used_credits) VALUES (1000, 0);
    v_current_credits := 1000;
  END IF;

  UPDATE suno_credits SET used_credits = used_credits + credits_to_deduct, updated_at = NOW();

  INSERT INTO suno_credit_logs (job_id, order_id, credits_used, description)
  VALUES (p_job_id, p_order_id, credits_to_deduct, p_description);

  v_result := jsonb_build_object(
    'success', true,
    'previous_credits', v_current_credits,
    'credits_deducted', credits_to_deduct,
    'remaining_credits', v_current_credits - credits_to_deduct
  );
  RETURN v_result;
END;
$$;

-- =====================
-- 6. FUNÇÃO mark_funnel_and_order_as_paid (usada por admin-order-actions e cakto-webhook)
-- =====================

CREATE OR REPLACE FUNCTION mark_funnel_and_order_as_paid(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orders 
  SET status = 'paid', 
      paid_at = COALESCE(paid_at, created_at, NOW()), 
      updated_at = NOW() 
  WHERE id = p_order_id AND status != 'paid';
  
  RETURN NULL;
END;
$$;

-- =====================
-- 7. TRIGGER SIMPLIFICADO: pago → Suno direto (sem dependência de lyrics_approvals)
-- =====================

CREATE OR REPLACE FUNCTION trigger_complete_payment_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_order_id := NEW.id;

    RAISE NOTICE '[Trigger] Pedido % marcado como paid - Disparando fluxo de geração', v_order_id;

    -- Obter URL do Supabase
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_supabase_url
        FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://fhndlazabynapislzkmw.supabase.co';
    END IF;

    -- Obter service key
    v_service_key := current_setting('app.settings.supabase_service_role_key', true);
    IF v_service_key IS NULL OR v_service_key = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_service_key
        FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
      EXCEPTION WHEN OTHERS THEN v_service_key := NULL;
      END;
    END IF;

    -- PASSO 1: Notificação (email / WhatsApp) - não bloquear se falhar
    BEGIN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/notify-payment-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        ),
        body    := jsonb_build_object('order_id', v_order_id::text)
      );
      RAISE NOTICE '[Trigger] notify-payment-webhook disparado para %', v_order_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Trigger] Erro notify-payment-webhook %: %', v_order_id, SQLERRM;
    END;

    -- PASSO 2: Gerar letra e enviar ao Suno (fluxo direto, sem verificação de approval)
    BEGIN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        ),
        body    := jsonb_build_object('order_id', v_order_id::text)
      );
      RAISE NOTICE '[Trigger] generate-lyrics-for-approval disparado para %', v_order_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Trigger] Erro generate-lyrics-for-approval %: %', v_order_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_complete_payment_flow ON orders;
CREATE TRIGGER trigger_complete_payment_flow
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION trigger_complete_payment_flow();
ALTER TABLE orders ENABLE TRIGGER trigger_complete_payment_flow;

-- =====================
-- 8. RECARREGAR SCHEMA CACHE
-- =====================

NOTIFY pgrst, 'reload schema';

SELECT 'SUCESSO! Todas as tabelas, colunas, policies, funções e trigger foram criados/atualizados.' AS resultado;
