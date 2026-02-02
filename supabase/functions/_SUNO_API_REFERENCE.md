# Referência da API Suno (sunoapi.org)

## ⚠️ INFORMAÇÕES CRÍTICAS

**Documentação oficial**: https://sunoapi.org/docs

**Base URL**: `https://api.sunoapi.org/api/v1`

**Autenticação**: Header `Authorization: Bearer YOUR_API_KEY`

---

## 📋 Endpoints Disponíveis

### 1. 🎵 Gerar Música

**POST** `/generate`

Inicia a geração de uma nova música com letra e estilo.

#### Request Headers
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

#### Request Body (Payload) - ATUALIZADO
```json
{
  "prompt": "string",              // Letra ou descrição da música
  "style": "string",               // Estilo musical (ex: "pop", "rock")
  "title": "string",               // Título da música
  "customMode": boolean,           // ⚠️ OBRIGATÓRIO: true = letra custom, false = auto-gerar
  "instrumental": boolean,         // ⚠️ OBRIGATÓRIO: false = vocal, true = só instrumental
  "model": "V4_5PLUS",             // Modelo da Suno (V3_5, V4, V4_5, V4_5PLUS, V5)
  // V5: Superior musical expression, faster generation
  // V4_5PLUS: Richer sound, new ways to create, max 8 min
  // V4_5: Superior genre blending, smarter prompts, faster output, up to 8 min
  // V4: Best audio quality, refined song structure, up to 4 min
  // V3_5: Solid arrangements, creative diversity, up to 4 min
  
  // CAMPOS OPCIONAIS AVANÇADOS
  "negativeTags": "string",        // Tags a evitar (max 200 chars)
  "vocalGender": "m" | "f",        // Gênero da voz (m=masculino, f=feminino)
  "styleWeight": 0.65,             // Peso do estilo (0.0-1.0, default 0.65)
  "weirdnessConstraint": 0.65,     // Criatividade (0.0-1.0, default 0.65)
  "audioWeight": 0.65,             // Peso do áudio (0.0-1.0, default 0.65)
  "callBackUrl": "string"          // ✅ OBRIGATÓRIO: URL para callbacks automáticos (formato: https://[project].supabase.co/functions/v1/suno-callback)
  "style": "string",               // Estilo musical (ex: "pop", "rock", "jazz")
  "title": "string",               // Título da música
  "customMode": boolean,           // ⚠️ OBRIGATÓRIO: true = letra custom, false = auto-gerar
  "instrumental": boolean,         // ⚠️ OBRIGATÓRIO: false = vocal, true = só instrumental
  "model": "V4_5PLUS"              // Modelo da Suno (V4_5PLUS é o mais recente)
}
```

**Campos Opcionais Avançados** (para uso futuro):
```json
{
  "negativeTags": "string",        // Tags a evitar (ex: "Heavy Metal, Drums")
  "vocalGender": "m" | "f",        // Gênero da voz
  "styleWeight": 0-1,              // Peso do estilo (padrão 0.65)
  "weirdnessConstraint": 0-1,      // Criatividade (padrão 0.65)
  "audioWeight": 0-1               // Peso do áudio (padrão 0.65)
}
```

#### Exemplo de Payload - Modo Customizado (com letra própria)
```json
{
  "prompt": "[Verse]\nLetra da primeira estrofe\n\n[Chorus]\nLetra do refrão",
  "style": "pop, romantic",
  "title": "Minha Música",
  "customMode": true,
  "instrumental": false,
  "model": "V4_5PLUS"
}
```

#### Exemplo de Payload - Modo Automático (AI gera letra)
```json
{
  "prompt": "A song about love and summer",
  "style": "pop",
  "title": "Summer Love",
  "customMode": false,
  "instrumental": false,
  "model": "V4_5PLUS"
}
```

#### Exemplo de Payload - Instrumental
```json
{
  "prompt": "Peaceful piano melody",
  "style": "classical",
  "title": "Piano Meditation",
  "customMode": false,
  "instrumental": true,
  "model": "V4_5PLUS"
}
```

#### Response (Sucesso)

**Formato novo (code-based)**:
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "34505837-41f0-4c68-b830-e8e051b72148",  // Usar este ID para polling
    "progress": "0%",
    "action": "generate",
    "mv": "chirp-bluejay"
  }
}
```

**NOTA**: A API pode retornar `taskId` ou `jobId` - suportar ambos para compatibilidade.

**Formato antigo (status-based)** - ainda suportado:
```json
{
  "status": "SUCCESS",
  "data": {
    "jobId": "34505837-41f0-4c68-b830-e8e051b72148"
  }
}
```

#### Response (Erro)
```json
{
  "code": 400,  // ou 401, 402, 429, etc.
  "msg": "customMode cannot be null"  // ou "instrumental cannot be null"
}
```

#### Status Codes
- `200` / `code: 200` - Sucesso
- `400` - Payload inválido (ex: campo obrigatório faltando)
- `401` - API Key inválida
- `402` - Créditos insuficientes
- `429` - Rate limit excedido

---

### 2. 🔍 Consultar Status do Job

**GET** `/query?id={jobId}`  
ou  
**GET** `/query?jobId={jobId}`  
ou  
**GET** `/feed?id={jobId}`

Consulta o status e progresso de uma música sendo gerada.

#### Request Headers
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

#### Endpoints Testados (em ordem de prioridade)
1. `/query?id={jobId}` - **Formato mais comum**
2. `/query?jobId={jobId}` - Formato alternativo
3. `/feed?id={jobId}` - Endpoint feed

#### Response (Processando)
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "progress": "45%",
    "status": "processing",
    "action": "generate",
    "mv": "chirp-bluejay"
  }
}
```

#### Response (Completo)
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "progress": "100%",
    "status": "complete",
    "musics": [
      {
        "musicId": "a7d3712d-2507-4d87-80d0-b60bb375a049",
        "audioUrl": "https://cdn1.suno.ai/a7d3712d.mp3",
        "videoUrl": "https://cdn1.suno.ai/a7d3712d.mp4",
        "imageUrl": "https://cdn2.suno.ai/image_a7d3712d.jpeg",
        "title": "Minha Música",
        "duration": 180,
        "createdAt": "2025-01-20T10:30:00Z"
      }
    ]
  }
}
```

#### Possíveis variações de campos (case-sensitive)
- `progress` ou `Progress`
- `musics` ou `Musics`
- `audioUrl` ou `AudioUrl`
- `videoUrl` ou `VideoUrl`
- `imageUrl` ou `ImageUrl`

---

### 3. 📞 Callback Automático (Recomendado)

**POST** para `callBackUrl` (configurado no payload de geração)

A Suno API envia automaticamente um callback quando a música está pronta, eliminando a necessidade de polling manual.

#### Configuração do Callback

No payload de geração, inclua:
```json
{
  "callBackUrl": "https://[seu-projeto].supabase.co/functions/v1/suno-callback"
}
```

#### Formato do Callback Recebido

A Suno API envia POST para o `callBackUrl` quando a música está pronta:

**Formato 1 (Recomendado)**:
```json
{
  "data": {
    "task_id": "34505837-41f0-4c68-b830-e8e051b72148",
    "callbackType": "complete",
    "data": [
      {
        "id": "a7d3712d-2507-4d87-80d0-b60bb375a049",
        "audio_url": "https://cdn1.suno.ai/a7d3712d.mp3",
        "video_url": "https://cdn1.suno.ai/a7d3712d.mp4",
        "image_url": "https://cdn2.suno.ai/image_a7d3712d.jpeg",
        "title": "Minha Música",
        "duration": 180
      }
    ]
  }
}
```

**Formato 2 (Alternativo)**:
```json
{
  "taskId": "34505837-41f0-4c68-b830-e8e051b72148",
  "status": "complete",
  "musics": [
    {
      "musicId": "a7d3712d-2507-4d87-80d0-b60bb375a049",
      "audioUrl": "https://cdn1.suno.ai/a7d3712d.mp3",
      "title": "Minha Música"
    }
  ]
}
```

#### Requisitos do Endpoint de Callback

- ✅ Deve aceitar requisições HTTP POST
- ✅ Deve processar JSON no corpo da requisição
- ✅ Deve responder com HTTP 200 dentro de 15 segundos
- ✅ Deve ser acessível publicamente (sem autenticação obrigatória)

#### Vantagens dos Callbacks

- ✅ Elimina necessidade de polling manual
- ✅ Notificação instantânea quando música está pronta
- ✅ Reduz carga no servidor (não precisa fazer requisições periódicas)
- ✅ Mais eficiente e escalável

#### Fallback: Polling Manual

Se o callback falhar ou não for configurado, ainda é possível usar polling manual via `/query?id={taskId}`.

---

## 🔧 Boas Práticas de Implementação

### 1. Validação de Payload

**⚠️ CRÍTICO**: Sempre incluir campos obrigatórios:
- `customMode`: boolean (⚠️ OBRIGATÓRIO - true para letra custom, false para auto-gerar)
- `instrumental`: boolean (⚠️ OBRIGATÓRIO - false para vocal, true para instrumental)
- `model`: string (obrigatório, usar "V4_5PLUS")
- `prompt`, `style`, `title`: strings (obrigatórias)

**MUDANÇA DE NOMENCLATURA**:
- ❌ Antigo: `tags` → ✅ Novo: `style`

```typescript
// ✅ CORRETO
const payload = {
  prompt: formattedLyrics,
  style: style || 'pop',
  title: title,
  customMode: true,  // ⚠️ SEMPRE incluir
  instrumental: false,  // ⚠️ SEMPRE incluir
  model: 'V4_5PLUS'
};

// ❌ ERRADO
const payload = {
  title: title,
  tags: style,  // ❌ Campo renomeado para "style"
  prompt: lyrics,
  model: 'V4_5PLUS'
  // customMode e instrumental faltando = erro 400
};
```

### 2. Parsing de Resposta (Robusto)
```typescript
// Suportar AMBOS os formatos e ambos os nomes (taskId/jobId)
const isSuccess = (result.code === 200 || result.status === 'SUCCESS');
const taskId = result.data?.taskId || result.data?.jobId;

if (isSuccess && taskId) {
  console.log('✅ Job criado:', taskId);
} else if (result.code && result.code !== 200) {
  throw new Error(`API Error (${result.code}): ${result.msg}`);
}
```

### 3. Polling com Múltiplos Endpoints
```typescript
const endpoints = [
  `/query?id=${jobId}`,
  `/query?jobId=${jobId}`,
  `/feed?id=${jobId}`
];

for (const endpoint of endpoints) {
  try {
    const response = await fetch(`https://api.sunoapi.org/api/v1${endpoint}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.code === 200 || data.status === 'SUCCESS') {
        return data; // Endpoint correto encontrado
      }
    }
  } catch (e) {
    continue; // Tentar próximo endpoint
  }
}
```

### 4. Extração de Dados (Case-Insensitive)
```typescript
const jobData = result.data || result;
const progress = jobData?.progress || jobData?.Progress || '0%';
const musics = jobData?.musics || jobData?.Musics;

if (musics && musics.length > 0) {
  const music = musics[0];
  const audioUrl = music.audioUrl || music.AudioUrl;
  const videoUrl = music.videoUrl || music.VideoUrl;
  // ...
}
```

---

## 📊 Estrutura do Workflow Completo

### Workflow com Callback (Recomendado)

```
1. POST /generate (com callBackUrl)
   ↓
   Recebe { taskId: "xxx" }
   ↓
2. Salvar taskId no banco
   ↓
3. Aguardar callback automático da Suno
   ↓
4. Callback recebido → Processar músicas
   ↓
5. Baixar e salvar no Supabase Storage
   ↓
6. Notificar cliente (email + WhatsApp)
```

### Workflow com Polling (Fallback)

```
1. POST /generate
   ↓
   Recebe { taskId: "xxx" }
   ↓
2. GET /query?id=xxx (polling a cada 5-10s)
   ↓
   { progress: "0%" } → Aguardar
   { progress: "50%" } → Aguardar
   { progress: "100%", musics: [...] } → Completo!
   ↓
3. Baixar audioUrl/videoUrl/imageUrl
   ↓
4. Salvar no Supabase Storage
   ↓
5. Notificar cliente (email + WhatsApp)
```

---

## ⚠️ Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `"customMode cannot be null"` | Campo `customMode` faltando | Adicionar `customMode: true` ao payload |
| `"instrumental cannot be null"` | Campo `instrumental` faltando | Adicionar `instrumental: false` ao payload |
| `"Please enter callBackUrl"` | Campo callBackUrl não enviado | ✅ OBRIGATÓRIO: Incluir callBackUrl no payload |
| `401 Unauthorized` | API Key inválida | Verificar `SUNO_API_KEY` no Supabase |
| `402 Payment Required` | Sem créditos | Adicionar créditos em sunoapi.org/billing |
| `429 Too Many Requests` | Rate limit | Aguardar 1-2 minutos antes de tentar novamente |
| `404 Not Found` (polling) | Endpoint errado | Tentar `/query?id=` em vez de `/query?jobId=` |
| `taskId/jobId undefined` | Parsing errado | Verificar `result.data?.taskId || result.data?.jobId` |
| `progress sempre 0%` | Polling muito rápido | Aguardar 5-10s entre requests |

---

## 🔐 Segurança

**NUNCA**:
- Expor a API Key no frontend
- Fazer chamadas diretas da API do cliente
- Armazenar API Key em localStorage/sessionStorage

**SEMPRE**:
- Fazer chamadas via Edge Functions (backend)
- Usar `SUNO_API_KEY` como secret do Supabase
- Validar permissões de admin antes de chamar a API

---

## 📝 Logs Recomendados

```typescript
console.log('🎯 [SUNO] Iniciando geração', {
  timestamp: new Date().toISOString(),
  title: payload.title,
  model: payload.model,
  customMode: payload.customMode,
  instrumental: payload.instrumental
});

console.log('📋 [SUNO] Payload completo:', {
  hasPrompt: !!payload.prompt,
  promptLength: payload.prompt?.length,
  style: payload.style,
  title: payload.title,
  customMode: payload.customMode,
  instrumental: payload.instrumental,
  model: payload.model
});

console.log('📥 [SUNO] Resposta recebida', {
  status: response.status,
  code: result.code,
  hasTaskId: !!result.data?.taskId,
  hasJobId: !!result.data?.jobId,
  taskId: result.data?.taskId || result.data?.jobId
});

console.log('📊 [SUNO] Status do Job', {
  jobId: jobId,
  progress: progress,
  hasMusics: !!musics
});
```

---

## 🔗 Links Úteis

- Dashboard: https://sunoapi.org/dashboard
- Billing: https://sunoapi.org/billing
- API Docs: https://sunoapi.org/docs
- Support: support@sunoapi.org
