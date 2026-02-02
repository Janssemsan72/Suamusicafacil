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

1. **Variáveis de ambiente** (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` – URL do projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` – Chave anônima (ou `VITE_SUPABASE_PUBLISHABLE_KEY`)
   - Marque **Production**, **Preview** e **Development**

2. **Deploy**: Conecte o repositório GitHub. O `vercel.json` está configurado (sem headers customizados para evitar ERR_CONTENT_DECODING_FAILED).

## Verificações pós-deploy

- [ ] Dashboard admin carrega (fallback manual se RPC `get_dashboard_stats` não existir)
- [ ] Métricas de Quiz (fallback vazio se `get-quiz-metrics` falhar)
- [ ] Colaboradores (fallback vazio se `user_roles` ou `profiles` falharem)
- [ ] Fluxo de checkout e pagamento
- [ ] Emails de confirmação e música pronta

## Troubleshooting: "Não abriu nada" / Página em branco

### 1. Abrir a URL manualmente
Após o deploy, a Vercel **não abre o site automaticamente**. Acesse:
- **Dashboard Vercel** → seu projeto → **Deployments** → clique em **Visit** ou na URL
- Ou use o domínio: `https://suamusicafacil.com` (se configurado)

### 2. Variáveis de ambiente obrigatórias
No painel Vercel: **Settings** → **Environment Variables**:
- `VITE_SUPABASE_URL` – URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` – Chave anônima (pública)

Sem essas variáveis, o app pode falhar ao inicializar.

### 3. Console do navegador
Abra DevTools (F12) → aba **Console**. Erros comuns:
- **404 em /assets/xxx.js** – problema de build ou cache
- **CSP blocked** – política de segurança bloqueando scripts
- **Supabase undefined** – variáveis de ambiente ausentes

### 4. Redeploy
Se o deploy anterior falhou:
1. Vercel → **Deployments** → **Redeploy** (último deploy)
2. Ou faça um novo push no GitHub para disparar novo deploy

### 5. Teste local do build
```bash
npm run build
npx vite preview
```
Acesse `http://localhost:4173` – se funcionar localmente, o problema está na Vercel.

### 6. 401 em favicon, logo, vídeo ou áudio (Deployment Protection)

Se favicon.svg, logo.png, vídeo ou áudio retornam **401 Unauthorized** na Vercel:

1. **Use a URL de produção** – A URL de preview (`suamusicafacil-xxx.vercel.app`) tem proteção por padrão. Use:
   - `https://suamusicafacil.vercel.app` (produção)
   - Ou seu domínio customizado (ex: `https://www.suamusicafacil.com`)

2. **Desative Deployment Protection para produção**:
   - Vercel → **Settings** → **Deployment Protection**
   - Em **Vercel Authentication** ou **Password Protection**, desative para **Production**
   - Mantenha proteção apenas em **Preview** se quiser proteger deploys de PRs

3. **Logo fallback** – O componente Logo exibe o texto "Sua Música Fácil" quando a imagem falha (401/404), garantindo que o nome da marca apareça mesmo com proteção ativa.

### 7. ERR_CONTENT_DECODING_FAILED
Erro de decodificação (compressão conflitante):

1. **Limpar cache** – Ctrl+Shift+R (hard refresh) ou abrir em aba anônima
2. **Aguardar deploy** – novo deploy pode levar 1–2 min para propagar
3. **Ver qual recurso falha** – DevTools → Network → filtrar por falha; ver se é HTML, JS ou script externo
4. Se for script externo (Facebook, Hotjar etc.), pode ser problema do provedor, não do seu site
