# Edge Functions usadas no frontend

Este documento consolida as Edge Functions invocadas pelo frontend, com base no codigo atual. Para cada funcao, detalha onde aparece, entrada esperada, fluxo inferido e saida esperada.

## Visao geral (arquitetura e padroes)

- O frontend chama Edge Functions principalmente via `supabase.functions.invoke(...)` em componentes, hooks e paginas.
- Existe um wrapper centralizado `invokeEdgeFunction` em `src/lib/edgeFunctionClient.ts` que adiciona:
  - Retry configuravel, timeout padrao (30s), e tratamento consistente de erros.
  - Header `Authorization: Bearer <token>` quando ha sessao.
  - Normalizacao do retorno para `{ data, error, success }`.
- Algumas chamadas nao usam o wrapper e passam `headers` manualmente, principalmente em acoes admin.
- Em varios pontos o frontend trata `data.success === false` como erro "controlado".

## Convencoes observadas

- Nomes de funcoes em kebab-case: `generate-lyrics-for-approval`, `get-quiz-metrics`.
- Payloads em snake_case: `order_id`, `approval_token`, `session_id`.
- Resposta frequente: `{ success: boolean, error?: string, ... }`.

## Autenticacao

- Admin/acoes sensiveis usam Bearer token explicito em `headers`.
- Algumas chamadas dependem da sessao do cliente (token implicito pelo Supabase client).
- Funcoes publicas (ex.: aprovacao de letras) nao exigem token no frontend.

## Catalogo de Edge Functions

### `create-checkout`
- Onde aparece: `src/pages/Checkout.tsx`
- Entrada esperada:
  - `session_id`, `quiz`, `customer_email`, `customer_whatsapp`, `plan`, `amount_cents`, `provider`, `transaction_id`
- Fluxo (inferido): cria quiz + order de forma atomica, retorna `quiz_id` e `order_id` para continuar o checkout.
- Saida esperada: `{ success: true, quiz_id, order_id }` ou `{ success: false, error }`

### `stripe-checkout`
- Onde aparece: `src/pages/Checkout.tsx`
- Entrada esperada:
  - `plan`, `success_url`, `cancel_url`, `customer_email`, `customer_whatsapp`, `metadata`
- Fluxo (inferido): cria sessao de checkout no Stripe.
- Saida esperada: `{ success: true, sessionId, url, ... }` ou `{ success: false, error }`

### `track-payment-click`
- Onde aparece: `src/pages/Checkout.tsx`, `src/components/CheckoutRedirectWrapper.tsx`
- Entrada esperada: `order_id`, `source`
- Fluxo (inferido): registra clique no CTA de pagamento.
- Saida esperada: nao usada no frontend (fire-and-forget).

### `verify-hotmart-payment-status`
- Onde aparece: `src/pages/HotmartReturn.tsx`
- Entrada esperada: `order_id`
- Fluxo (inferido): consulta status de pagamento no Hotmart para atualizar UI.
- Saida esperada: `{ success: true, status, ... }` ou `{ success: false, error }`

### `get-regional-pricing`
- Onde aparece: `src/hooks/useRegionalPricing.ts`
- Entrada esperada: `session_token`
- Fluxo (inferido): retorna precos regionais com cache por sessao.
- Saida esperada: `{ success: true, pricing, ... }` ou `{ success: false, error }`

### `detect-country-by-ip`
- Onde aparece: `src/lib/edgeLocale.ts`
- Entrada esperada: sem body.
- Fluxo (inferido): detecta pais/locale por IP.
- Saida esperada: `{ success: true, country_code, locale, ... }` ou `{ success: false, error }`

### `get-lyrics-approval`
- Onde aparece: `src/pages/ApproveLyrics.tsx`
- Entrada esperada: `approval_token`
- Fluxo (inferido): busca dados da aprovacao publica.
- Saida esperada: `{ success: true, approval, ... }` ou `{ success: false, error }`

### `approve-lyrics`
- Onde aparece: `src/pages/ApproveLyrics.tsx`
- Entrada esperada: `approval_token`
- Fluxo (inferido): aprova a letra e dispara fluxo de geracao/entrega.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `reject-lyrics`
- Onde aparece: `src/pages/ApproveLyrics.tsx`
- Entrada esperada: `approval_token`, `rejection_reason`
- Fluxo (inferido): rejeita letra e registra motivo.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `generate-lyrics-for-approval`
- Onde aparece: `src/pages/admin/AdminOrderDetails.tsx`, `src/components/admin/GenerateLyricsDialog.tsx`, `src/pages/admin/AdminHotmartSync.tsx`
- Entrada esperada: `order_id`
- Autenticacao: token admin em alguns fluxos (ex.: `AdminHotmartSync`).
- Fluxo (inferido): inicia geracao de letras com aprovacao para um pedido.
- Saida esperada: `{ success: true, job_id? }` ou `{ success: false, error }`

### `generate-lyrics-internal`
- Onde aparece: `src/pages/AdminDashboard.tsx`, `src/components/admin/LyricsCard.tsx`
- Entrada esperada: `job_id`
- Fluxo (inferido): reprocessa geracao de letras para job existente.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `regenerate-lyrics`
- Onde aparece: `src/hooks/useLyricsApprovals.ts`, `src/hooks/useRegenerateAllLyrics.ts`
- Entrada esperada: `approval_id` (ou identificador equivalente no hook)
- Autenticacao: token admin (via header).
- Fluxo (inferido): reprocessa letra em um fluxo admin.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-approve-lyrics`
- Onde aparece: `src/hooks/useLyricsApprovals.ts`
- Entrada esperada: `approval_id`
- Autenticacao: token admin (header).
- Fluxo (inferido): aprova letra via painel admin.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-reject-lyrics`
- Onde aparece: `src/hooks/useLyricsApprovals.ts`
- Entrada esperada: `approval_id`, `rejection_reason`
- Autenticacao: token admin (header).
- Fluxo (inferido): rejeita letra via painel admin.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-unapprove-lyrics`
- Onde aparece: `src/hooks/useLyricsApprovals.ts`
- Entrada esperada: `approval_id`
- Autenticacao: token admin (header).
- Fluxo (inferido): remove aprovacao da letra.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `delete-lyrics-approval`
- Onde aparece: `src/hooks/useLyricsApprovals.ts`
- Entrada esperada: `approval_id`
- Autenticacao: token admin (header).
- Fluxo (inferido): remove aprovacao de letra (admin).
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-edit-lyrics`
- Onde aparece: `src/pages/admin/AdminLyrics.tsx`
- Entrada esperada: `approval_id`, `lyrics`
- Autenticacao: depende da sessao do cliente admin.
- Fluxo (inferido): atualiza a letra diretamente.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-order-actions`
- Onde aparece: `src/pages/admin/AdminOrderDetails.tsx`, `src/pages/admin/AdminBehaviorAnalytics.tsx`
- Entrada esperada:
  - `action`, `order_id`, `data` (opcional)
  - Exemplo: `action: "clear_behavior_problems"`
- Autenticacao: token admin (header).
- Fluxo (inferido): executa acoes administrativas sobre pedidos ou dados correlatos.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-song-actions`
- Onde aparece: `src/pages/admin/AdminSongDetails.tsx`
- Entrada esperada:
  - `action`, `songId` (ex.: `release_now`, `postpone`, `update_metadata`, `delete`)
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): executa acoes administrativas em uma musica.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-get-ready-songs`
- Onde aparece: `src/hooks/useAdminData.ts`
- Entrada esperada: `orderIds` (array de ids)
- Fluxo (inferido): retorna musicas prontas para liberar por pedido.
- Saida esperada: `{ success: true, songs }` ou `{ success: false, error }`

### `admin-generate-lyrics`
- Onde aparece: `src/pages/admin/AdminGenerate.tsx`
- Entrada esperada: `quiz_data`, `custom_instructions`
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): gera letra manualmente via admin.
- Saida esperada: `{ success: true, lyrics, job_id? }` ou `{ success: false, error }`

### `admin-generate-audio`
- Onde aparece: `src/pages/admin/AdminGenerate.tsx`
- Entrada esperada: payload de audio (ex.: letra, estilo, voz, order_id)
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): solicita geracao de audio.
- Saida esperada: `{ success: true, task_id, ... }` ou `{ success: false, error }`

### `admin-poll-audio`
- Onde aparece: `src/pages/admin/AdminGenerate.tsx`
- Entrada esperada: `task_id`
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): consulta status de geracao de audio.
- Saida esperada: `{ success: true, status, ... }` ou `{ success: false, error }`

### `admin-finalize-generation`
- Onde aparece: `src/pages/admin/AdminGenerate.tsx`
- Entrada esperada: payload com referencias do audio gerado (task_id, order_id, etc.)
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): finaliza o processo e salva audio/musica.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `send-music-released-email`
- Onde aparece: `src/pages/admin/AdminOrderDetails.tsx`, `src/pages/admin/AdminReleases.tsx`, `src/hooks/useAdminData.ts`
- Entrada esperada: `songId`, `orderId`, `force`
- Fluxo (inferido): envia email de musica liberada e pode acionar webhook em paralelo.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `send-music-ready-email`
- Onde aparece: `src/pages/admin/AdminOrderDetails.tsx`
- Entrada esperada: `order_id`
- Fluxo (inferido): envia email de musica pronta (ainda nao liberada).
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-send-reply`
- Onde aparece: `src/pages/admin/AdminEmails.tsx`
- Entrada esperada: `to_email`, `subject`, `html_content`, `in_reply_to`, `thread_id`, `received_email_id`
- Fluxo (inferido): responde email via painel admin.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-send-custom-email`
- Onde aparece: `src/pages/admin/AdminEmails.tsx`
- Entrada esperada: `to_email`, `subject`, `html_content`
- Fluxo (inferido): envia email personalizado.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `test-send-email-template`
- Onde aparece: `src/pages/admin/AdminEmails.tsx`
- Entrada esperada: `template_type`, `language`, `to_email`, `variables`
- Fluxo (inferido): envia email de teste com template.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-get-collaborator-emails`
- Onde aparece: `src/pages/admin/AdminCollaborators.tsx`, `src/pages/admin/AdminLogs.tsx`
- Entrada esperada: `user_ids` (array)
- Fluxo (inferido): retorna emails de colaboradores por id.
- Saida esperada: `{ success: true, emails }` ou `{ success: false, error }`

### `admin-create-collaborator`
- Onde aparece: `src/pages/admin/AdminCollaborators.tsx`, `src/pages/admin/AdminSettings.tsx`
- Entrada esperada: `email`, `password`
- Fluxo (inferido): cria colaborador admin.
- Saida esperada: `{ success: true, user_id }` ou `{ success: false, error }`

### `admin-update-collaborator`
- Onde aparece: `src/pages/admin/AdminCollaborators.tsx`
- Entrada esperada: `user_id`, `email` (opcional), `password` (opcional)
- Fluxo (inferido): atualiza colaborador.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `admin-update-collaborator-permissions`
- Onde aparece: `src/pages/admin/components/AdminUserCard.tsx`
- Entrada esperada: `user_id`, `permissions` (array)
- Fluxo (inferido): atualiza permissoes de colaborador.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `convert-test-to-normal`
- Onde aparece: `src/pages/admin/AdminOrders.tsx`
- Entrada esperada: `orderId`, `newEmail` (opcional), `newCustomerName` (opcional)
- Fluxo (inferido): converte venda teste em venda normal.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `clarity-analytics`
- Onde aparece: `src/hooks/useBehaviorAnalytics.ts`
- Entrada esperada: sem body (usa token).
- Autenticacao: token via header.
- Fluxo (inferido): consulta analytics do Clarity.
- Saida esperada: `{ success: true, data }` ou `{ success: false, error }`

### `hotjar-analytics`
- Onde aparece: `src/hooks/useBehaviorAnalytics.ts`
- Entrada esperada: sem body (usa token).
- Autenticacao: token via header.
- Fluxo (inferido): consulta analytics do Hotjar.
- Saida esperada: `{ success: true, data }` ou `{ success: false, error }`

### `get-quiz-metrics`
- Onde aparece: `src/pages/admin/AdminQuizMetrics.tsx`
- Entrada esperada: `start_date`, `end_date`
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): retorna metricas de quiz.
- Saida esperada: `{ success: true, metrics }` ou `{ success: false, error }`

### `test-whatsapp-template`
- Onde aparece: `src/pages/admin/AdminWhatsappTemplates.tsx`
- Entrada esperada: `template_id`, `whatsapp_number`, `variables`
- Fluxo (inferido): envia mensagem de teste via template.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `send-checkout-link`
- Onde aparece: `src/pages/admin/AdminWhatsappFunnel.tsx`
- Entrada esperada: `order_id`
- Autenticacao: depende da sessao admin.
- Fluxo (inferido): envia link de checkout por WhatsApp.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `dispatch-funnel-step`
- Onde aparece: `src/pages/admin/AdminWhatsappFunnel.tsx`
- Entrada esperada: `funnel_id`, `step`
- Autenticacao: token admin (header).
- Fluxo (inferido): dispara passo especifico do funil.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

### `dispatch-all-pending-funnels`
- Onde aparece: `src/pages/admin/AdminWhatsappFunnel.tsx`
- Entrada esperada: sem body.
- Autenticacao: token admin (header).
- Fluxo (inferido): dispara todos os funis pendentes.
- Saida esperada: `{ success: true }` ou `{ success: false, error }`

