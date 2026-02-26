-- ==========================================
-- TRIGGER SIMPLIFICADO: pago → Suno direto
-- Sem dependência de lyrics_approvals (removida para evitar erro "relation does not exist")
-- Sem etapa de aprovação manual - letra do quiz.answers vai direto para Suno
-- ==========================================

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

    v_service_key := current_setting('app.settings.supabase_service_role_key', true);
    IF v_service_key IS NULL OR v_service_key = '' THEN
      BEGIN
        SELECT decrypted_secret INTO v_service_key
        FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
      EXCEPTION WHEN OTHERS THEN v_service_key := NULL;
      END;
    END IF;

    -- PASSO 1: Notificação (não bloquear se falhar)
    BEGIN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/notify-payment-webhook',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        ),
        body    := jsonb_build_object('order_id', v_order_id::text)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Trigger] Erro notify-payment-webhook %: %', v_order_id, SQLERRM;
    END;

    -- PASSO 2: Gerar letra e enviar ao Suno (fluxo direto)
    BEGIN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/generate-lyrics-for-approval',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        ),
        body    := jsonb_build_object('order_id', v_order_id::text)
      );
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
