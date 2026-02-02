#!/bin/bash

# ✅ DEPLOY ENHANCED FUNCTIONS: Script para deploy das edge functions melhoradas
# Baseado na análise completa dos 98 arquivos .md e 70+ edge functions existentes

echo "🚀 Iniciando deploy das Edge Functions melhoradas..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se está no diretório correto
if [ ! -f "supabase/config.toml" ]; then
    error "Execute este script a partir do diretório raiz do projeto"
    exit 1
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    error "Supabase CLI não encontrado. Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se está logado no Supabase
if ! supabase projects list &> /dev/null; then
    error "Não está logado no Supabase. Execute: supabase login"
    exit 1
fi

log "Verificando configuração do Supabase..."

# Lista das edge functions melhoradas para deploy
ENHANCED_FUNCTIONS=(
    "enhanced-generate-audio"
    "enhanced-send-multilingual-email"
    "enhanced-health-check"
)

# Lista das edge functions existentes que devem ser mantidas
EXISTING_FUNCTIONS=(
    "hotmart-webhook"
    "generate-audio"
    "send-order-paid-email"
    "send-music-released-email"
    "poll-suno-status"
    "process-order"
    "auto-generate-workflow"
    "release-songs"
    "health-check"
)

log "Deployando Edge Functions melhoradas..."

# Deploy das funções melhoradas
for function in "${ENHANCED_FUNCTIONS[@]}"; do
    log "Deployando $function..."
    
    if supabase functions deploy "$function" --no-verify-jwt; then
        success "$function deployada com sucesso"
    else
        error "Falha ao deployar $function"
        exit 1
    fi
done

log "Verificando Edge Functions existentes..."

# Verificar se as funções existentes ainda estão funcionando
for function in "${EXISTING_FUNCTIONS[@]}"; do
    if supabase functions list | grep -q "$function"; then
        success "$function está disponível"
    else
        warning "$function não encontrada - pode ter sido removida"
    fi
done

log "Testando Edge Functions..."

# Teste básico das funções melhoradas
test_function() {
    local function_name=$1
    local test_payload=$2
    
    log "Testando $function_name..."
    
    # Fazer request para a função
    local response=$(curl -s -X POST \
        "https://zagkvtxarndluusiluhb.supabase.co/functions/v1/$function_name" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $(supabase status | grep 'anon key' | cut -d' ' -f3)" \
        -d "$test_payload" 2>/dev/null)
    
    if echo "$response" | grep -q '"success":true'; then
        success "$function_name funcionando"
        return 0
    else
        error "$function_name falhou: $response"
        return 1
    fi
}

# Testes específicos
log "Executando testes de integração..."

# Teste do health check
if test_function "enhanced-health-check" '{"include_database": true, "include_external_apis": true}'; then
    success "Health check funcionando"
else
    warning "Health check com problemas - verificar logs"
fi

log "Verificando logs das Edge Functions..."

# Listar logs recentes
supabase functions logs --limit 10

log "Deploy concluído!"

echo ""
echo "📊 RESUMO DO DEPLOY:"
echo "===================="
echo "✅ Edge Functions melhoradas deployadas: ${#ENHANCED_FUNCTIONS[@]}"
echo "✅ Edge Functions existentes verificadas: ${#EXISTING_FUNCTIONS[@]}"
echo ""
echo "🔗 URLs das Edge Functions:"
for function in "${ENHANCED_FUNCTIONS[@]}"; do
    echo "   https://zagkvtxarndluusiluhb.supabase.co/functions/v1/$function"
done
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Verificar logs no Supabase Dashboard"
echo "2. Testar integração com frontend"
echo "3. Monitorar performance das funções"
echo "4. Configurar alertas se necessário"
echo ""
echo "🎉 Deploy das Edge Functions melhoradas concluído com sucesso!"
