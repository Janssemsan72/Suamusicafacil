# Deploy em Produção - Sua Música Fácil

## Pré-requisitos

### 1. Supabase

1. **Migrations**: Aplique todas as migrations no projeto Supabase:
   ```bash
   npx supabase db push
   ```
   Ou via Dashboard: SQL Editor → executar migrations em ordem.

2. **Secrets**: Configure as variáveis em **Project Settings → Edge Functions → Secrets**:
   - `OPENAI_API_KEY`
   - `SUNO_API_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (ex: contato@suamusicafacil.com)
   - `APP_NAME` (ex: Sua Música Fácil)

3. **Edge Functions**: Faça deploy das funções necessárias:
   ```bash
   npx supabase functions deploy get-quiz-metrics
   npx supabase functions deploy admin-get-collaborator-emails
   npx supabase functions deploy generate-lyrics-for-approval
   npx supabase functions deploy generate-audio-internal
   # ... outras funções conforme uso
   ```

### 2. Vercel

1. **Variáveis de ambiente**: Configure no painel do Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **Deploy**: Conecte o repositório GitHub e faça deploy. O `vercel.json` já está configurado.

## Verificações pós-deploy

- [ ] Dashboard admin carrega (fallback manual se RPC `get_dashboard_stats` não existir)
- [ ] Métricas de Quiz (fallback vazio se `get-quiz-metrics` falhar)
- [ ] Colaboradores (fallback vazio se `user_roles` ou `profiles` falharem)
- [ ] Fluxo de checkout e pagamento
- [ ] Emails de confirmação e música pronta
