# Configuração de Secrets (Supabase)

**Nenhuma chave ou variável de ambiente deve ser commitada no repositório.**

Todas as variáveis sensíveis (API keys, tokens, senhas) devem ser configuradas via **Supabase Secrets**:

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione o projeto
3. Vá em **Project Settings** → **Edge Functions** → **Secrets**
4. Adicione cada variável necessária (ex: `OPENAI_API_KEY`, `SUNO_API_KEY`, `RESEND_API_KEY`, etc.)

## Variáveis comuns

| Secret | Descrição |
|--------|-----------|
| `OPENAI_API_KEY` | Chave da API OpenAI (geração de letras) |
| `SUNO_API_KEY` | Chave da API Suno (geração de áudio) |
| `RESEND_API_KEY` | Chave da API Resend (envio de emails) |
| `RESEND_FROM_EMAIL` | Email remetente (ex: contato@suamusicafacil.com) |
| `APP_NAME` | Nome da empresa (ex: Sua Música Fácil) |

## Frontend (Vite)

Para o frontend, use variáveis com prefixo `VITE_` no arquivo `.env` local (nunca commitado). Em produção (Vercel), configure as variáveis no painel do Vercel.
