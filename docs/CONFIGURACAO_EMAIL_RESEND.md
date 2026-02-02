# Configuração de Email (Resend) - Sua Música Fácil

**Data:** Fevereiro 2025

---

## Variáveis de Ambiente

Configure no Supabase (Edge Functions → Secrets) e/ou no `.env`:

```env
RESEND_FROM_EMAIL=contato@suamusicafacil.com
APP_NAME=Sua Música Fácil
RESEND_REPLY_TO=contato@suamusicafacil.com
SITE_URL=https://suamusicafacil.com
```

### Descrição

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `RESEND_FROM_EMAIL` | `contato@suamusicafacil.com` | Endereço de email do remetente (apenas o email) |
| `APP_NAME` | `Sua Música Fácil` | Nome exibido no cabeçalho do email |
| `RESEND_REPLY_TO` | `contato@suamusicafacil.com` | Email para respostas (opcional, usa RESEND_FROM_EMAIL se não definido) |
| `SITE_URL` | `https://suamusicafacil.com` | URL base do site para links nos emails |

### Formato do cabeçalho

O resultado será: **"Sua Música Fácil" <contato@suamusicafacil.com>**

---

## Onde são usadas

- **send-checkout-email**: Emails de checkout e lembretes
- **send-music-ready-email**: Emails de música pronta
- **send-music-released-email**: Emails de música lançada
- **send-email-with-variables**: Emails transacionais genéricos
- **admin-send-reply**: Respostas a emails recebidos
- **admin-send-custom-email**: Emails personalizados do admin
- **email-utils** (shared): Função centralizada de envio

---

## Requisitos

1. **Domínio verificado no Resend**: O domínio `suamusicafacil.com` deve estar verificado no painel do Resend para envio funcionar.
2. **RESEND_API_KEY**: Chave da API do Resend configurada nas variáveis de ambiente.
