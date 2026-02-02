// ✅ VERSÃO STANDALONE PARA DEPLOY MANUAL VIA DASHBOARD
// Este arquivo inclui todo o código necessário (sem dependências de _shared)

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

// ==========================================
// CÓDIGO DOS ARQUIVOS _shared (INLINE)
// ==========================================

// ✅ SEGURANÇA: Headers de segurança
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src 'self'"
};

// ✅ SEGURANÇA: CORS restritivo
const ALLOWED_ORIGINS = [
  'https://musiclovely.com',
  'https://www.musiclovely.com',
  'http://localhost:8084',
  'http://localhost:5173',
  'http://127.0.0.1:8084',
  'http://127.0.0.1:5173'
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
  };
};

const getSecureHeaders = (origin: string | null) => {
  return {
    ...getCorsHeaders(origin),
    ...securityHeaders
  };
};

// ✅ SEGURANÇA: Rate limiting
interface RateLimitConfig {
  identifier: string;
  action: string;
  maxCount: number;
  windowMinutes: number;
}

const checkRateLimit = async (config: RateLimitConfig): Promise<boolean> => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('check_rate_limit', {
    _identifier: config.identifier,
    _action: config.action,
    _max_count: config.maxCount,
    _window_minutes: config.windowMinutes
  });

  if (error) {
    console.error('Rate limit check error:', error);
    return true; // fail-open
  }

  return data === true;
};

const RATE_LIMITS = {
  CHECKOUT: { maxCount: 5, windowMinutes: 60 },
  GENERATE_LYRICS: { maxCount: 10, windowMinutes: 60 },
  GENERATE_LYRICS_INTERNAL: { maxCount: 10, windowMinutes: 60 },
  GENERATE_AUDIO_INTERNAL: { maxCount: 10, windowMinutes: 60 },
  UPLOAD: { maxCount: 20, windowMinutes: 60 },
  EMAIL: { maxCount: 3, windowMinutes: 60 },
  ADMIN_ACTION: { maxCount: 50, windowMinutes: 60 },
} as const;

// Função para converter string de lyrics formatada em array de verses
function parseLyricsString(lyricsString: string): Array<{ type: string; text: string }> {
  const verses: Array<{ type: string; text: string }> = [];
  
  // Dividir por seções usando os marcadores
  const sections = lyricsString.split(/(?=\[(?:Verso|Pré-Refrão|Refrão|Ponte|Refrão Final)\s*\d*\])/i);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Extrair tipo e conteúdo
    const match = section.match(/\[(Verso\s*\d*|Pré-Refrão|Refrão(?:\s*Final)?|Ponte)\s*\](.*)/is);
    if (!match) continue;
    
    const sectionType = match[1].trim();
    let content = match[2].trim();
    
    // Mapear tipo
    let type: string;
    if (sectionType.match(/^Verso/i)) {
      type = 'verse';
    } else if (sectionType.match(/Pré-Refrão/i)) {
      type = 'pre-chorus';
    } else if (sectionType.match(/Refrão\s*Final/i)) {
      type = 'chorus';
    } else if (sectionType.match(/Refrão/i)) {
      type = 'chorus';
    } else if (sectionType.match(/Ponte/i)) {
      type = 'bridge';
    } else {
      continue; // Tipo desconhecido, pular
    }
    
    // Limpar conteúdo (remover linhas vazias no início/fim)
    content = content.replace(/^\n+|\n+$/g, '').trim();
    
    if (content) {
      verses.push({ type, text: content });
    }
  }
  
  return verses;
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const secureHeaders = getSecureHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: secureHeaders });
  }

  // ✅ SEGURANÇA: Verificar rate limit para ações admin
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const authHeader = req.headers.get('Authorization');
  const userId = authHeader ? 'authenticated' : 'anonymous';
  const rateLimitKey = `${clientIP}:${userId}:admin-generate-lyrics`;
  
  const rateLimitConfig = RATE_LIMITS.ADMIN_ACTION;
  const canProceed = await checkRateLimit({
    identifier: rateLimitKey,
    action: 'admin-generate-lyrics',
    maxCount: rateLimitConfig.maxCount,
    windowMinutes: rateLimitConfig.windowMinutes
  });
  
  if (!canProceed) {
    console.warn(`⚠️ Rate limit exceeded for admin action: ${rateLimitKey}`);
    return new Response(JSON.stringify({
      error: 'Muitas tentativas. Por favor, aguarde alguns minutos.',
      success: false
    }), {
      status: 429,
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Não autenticado - token não fornecido',
        success: false
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Não autenticado - token inválido',
        success: false
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se é admin
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('Erro ao verificar role:', roleError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao verificar permissões',
        success: false
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Sem permissão de admin',
        success: false
      }), {
        status: 200,
        headers: { ...secureHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quiz_data, custom_instructions } = await req.json();

    // Verificar API key PRIMEIRO
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const openAIModel = (Deno.env.get('OPENAI_MODEL') || '').trim() || 'gpt-4.1';
    if (!openAIApiKey) {
      console.error('❌ OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY não configurada. Configure em Settings > Functions no Supabase.');
    }

    console.log(`🎵 Gerando letra usando OpenAI ${openAIModel}...`);
    console.log('📝 Dados recebidos:', {
      about_who: quiz_data.about_who,
      style: quiz_data.style,
      language: quiz_data.language,
      hasCustomInstructions: !!custom_instructions
    });

    // Preparar variáveis para o prompt
    const language = quiz_data.language || 'português';
    const styleTxt = quiz_data.style || 'Pop';
    const emotionalTone = quiz_data.desired_tone || 'amor profundo, calma, lenta, profundamente emocionante';
    const aboutWho = quiz_data.about_who || 'uma pessoa especial';
    const relationship = quiz_data.relationship || 'relação especial';
    const occasion = quiz_data.occasion || 'momento especial';
    const qualities = (quiz_data.qualities ?? '').trim();
    const keyMoments = (quiz_data.key_moments ?? '').trim();
    const memoriesTxt = (quiz_data.memories ?? '').trim();
    const messageTxt = quiz_data.message || 'mensagem do coração';

    // Quiz simplificado: apenas message preenchido (qualities, key_moments, memories vazios)
    const isSimplifiedQuiz = !qualities && !keyMoments && !memoriesTxt && !!messageTxt;

    const historySection = isSimplifiedQuiz
      ? `Esta música é sobre ${aboutWho}, que é ${relationship}.
${occasion ? `Ocasião: ${occasion}\n` : ''}

HISTÓRIA E MENSAGEM DO CLIENTE (todo o contexto está abaixo):
${messageTxt}`
      : `SOBRE QUEM: ${aboutWho}
RELACIONAMENTO: ${relationship}
OCASIÃO: ${occasion}
QUALIDADES ESPECIAIS: ${qualities || '(não informado)'}
MOMENTOS-CHAVE: ${keyMoments || '(não informado)'}
MEMÓRIAS COMPARTILHADAS: ${memoriesTxt || '(não informado)'}
MENSAGEM PRINCIPAL: ${messageTxt}`;
    
    // Função para detectar se é homenagem coletiva
    const isCollectiveHonor = (aboutWhoText: string): boolean => {
      if (!aboutWhoText || typeof aboutWhoText !== 'string') return false;
      const text = aboutWhoText.trim().toLowerCase();
      
      // Termos coletivos implícitos
      const collectiveTerms = [
        'amigos', 'amigas', 'filhos', 'filhas', 'família', 'familia',
        'irmãos', 'irmãs', 'irmas', 'pais', 'mães', 'maes',
        'netos', 'netas', 'sobrinhos', 'sobrinhas', 'primos', 'primas',
        'cunhados', 'cunhadas', 'genros', 'noras', 'tios', 'tias',
        'avós', 'avôs', 'avos', 'vovós', 'vovôs', 'vovos'
      ];
      
      // Verificar se contém termos coletivos
      if (collectiveTerms.some(term => text.includes(term))) {
        return true;
      }
      
      // Verificar se há dois ou mais nomes (padrão: "Nome1, Nome2" ou "Nome1 e Nome2")
      const nameCount = (text.match(/\b[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*\b/g) || []).length;
      const hasComma = text.includes(',');
      const hasE = /\be\s+[A-ZÁÉÍÓÚÂÊÔÇ]/.test(text);
      
      // Se tem vírgula ou "e" entre nomes, ou mais de um nome, é coletivo
      if ((hasComma || hasE) && nameCount >= 2) {
        return true;
      }
      
      return false;
    };
    
    const isCollective = isCollectiveHonor(aboutWho);
    
    const systemPrompt = `Você é um compositor cristão profissional, especializado em transformar histórias reais em músicas emocionais e profundamente humanas.

OBJETIVO:
Criar letras originais, marcantes e cinematográficas, com foco em:
amor, família, fé, superação, gratidão e cura emocional;
detalhes concretos da história contada pelo usuário (nomes, lugares, momentos, falas, gestos);
narrativa contínua que conte TODA a história do cliente.

CONTEXTOS:
Use o idioma: ${language}
Estilo musical: ${styleTxt}
Tom emocional: amor profundo, calma, lenta, profundamente emocionante
SEMPRE use linguagem cristã reverente e esperançosa, com referências a Deus de forma natural e reverente.

════════════════════════════════════════════════════
REGRA FUNDAMENTAL - PERSPECTIVA (PRIORIDADE MÁXIMA)
════════════════════════════════════════════════════
A letra DEVE ser escrita em PRIMEIRA PESSOA, como uma DECLARAÇÃO DE AMOR DIRETA.

👤 QUEM FALA: O AUTOR (quem comprou/encomendou a música)
💝 PARA QUEM: A PESSOA HOMENAGEADA (destinatário do presente)

✅ OBRIGATÓRIO usar:
- "Eu" para o autor (eu te amo, eu sinto, eu lembro, eu agradeço)
- "Você/Te/Teu/Sua" para o homenageado (você é especial, te amo, sua voz, teu sorriso)

❌ PROIBIDO usar terceira pessoa para o homenageado:
- "Ela é linda" → CORRETO: "Você é linda"
- "Ele me ensinou" → CORRETO: "Você me ensinou"  
- "Dela eu aprendi" → CORRETO: "De você eu aprendi"
- "O amor dele" → CORRETO: "O seu amor" ou "Teu amor"

A música é um PRESENTE sendo entregue. É como se o autor estivesse olhando nos olhos da pessoa homenageada e cantando diretamente para ela.

────────────────────────
REGRAS CRÍTICAS (PRIORIDADE ALTA)
────────────────────────

1. USO DOS DETALHES (SEMÂNTICO, NÃO LITERAL):
Use TODOS os detalhes relevantes do quiz (nomes, qualidades, memórias, datas, lugares, gestos).
→ Qualidades devem ser transformadas em AÇÕES, ATITUDES ou IMAGENS poéticas.
→ Nunca liste palavras, qualidades ou conceitos literalmente.

2. PROIBIÇÃO DE INVENÇÃO:
Nunca invente fatos, datas, pessoas, locais ou eventos que não estejam explicitamente mencionados no quiz.

3. NOMES PRÓPRIOS:
Todos os NOMES PRÓPRIOS citados no quiz (pessoas, filhos, parentes, pets, locais específicos) DEVEM aparecer na letra de forma natural.
→ Conceitos, atributos, qualidades e sentimentos NÃO são nomes próprios.

3.1 REGRA CRÍTICA – NOME DA PESSOA HOMENAGEADA:
O nome da pessoa homenageada (campo "about_who") deve aparecer APENAS no REFRÃO e no REFRÃO FINAL.
⚠ É PROIBIDO citar esse nome em versos, pré-refrão ou ponte.
Nessas partes, utilize apenas pronomes: "você", "te", "teu/tua", "seu/sua".

REGRA DE DIGNIDADE DO NOME DA PESSOA HOMENAGEADA:
Quando o nome da pessoa homenageada aparecer no refrão:

Ele deve ser o núcleo emocional da frase

Deve estar integrado à oração principal, nunca isolado

❌ É PROIBIDO colocar o nome entre vírgulas, listas ou sequências de palavras

O nome deve carregar sentido, não apenas ocupar espaço.

3.2 REGRA DO REFRÃO (CRÍTICA):
O refrão deve ser UMA FRASE POÉTICA COMPLETA, emocional, fluida e fácil de cantar.
❌ É PROIBIDO listar palavras, nomes ou conceitos em sequência.
O nome da pessoa homenageada deve estar INTEGRADO naturalmente à frase do refrão.

3.3 REGRA SINTÁTICA DO REFRÃO (OBRIGATÓRIA):
Todo refrão e refrão final DEVEM conter:
- Pelo menos UM verbo explícito
- Um sujeito identificável
- Uma frase poética completa, com sentido do início ao fim

❌ É PROIBIDO refrão formado por:
- listas de palavras
- nomes separados por vírgula
- conceitos soltos sem verbo

Se não houver verbo, o refrão é considerado inválido.

4. TAMANHO:
Máximo de 4800 caracteres (para caber no limite de 5000 do Suno com folga).

5. REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
Números sempre por extenso: "1" → "um", "2" → "dois", "10" → "dez", "100" → "cem", etc.
Números com vírgula sempre por extenso: "1,5" → "um vírgula cinco", "2,3" → "dois vírgula três", etc.
Unidades sempre por extenso: "km" → "quilômetros", "kg" → "quilogramas", "m" → "metros", etc.
NUNCA use números ou unidades abreviadas na letra.

6. ESTILO DE ESCRITA:
Evite rimas forçadas.
Priorize fluidez, emoção verdadeira e musicalidade.

7. PROIBIÇÕES:
- PROIBIDO usar "xonei", "xonado", "xone", "xona" ou QUALQUER variação (maiúsculas, minúsculas, com ou sem acentos).
- PROIBIDO usar "amante", exceto se o cliente mencionar explicitamente.
- PROIBIDO usar terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.

REGRA DE APELIDOS CARINHOSOS:
Se o quiz mencionar um apelido carinhoso:

Ele NÃO é tratado como gíria proibida

Deve ser usado apenas se explicitamente citado pelo cliente

Deve aparecer contextualizado emocionalmente (carinho, intimidade, afeto)

❌ É PROIBIDO usar apelido como palavra solta ou em listas

Preferência de uso: VERSOS, nunca como elemento jogado no refrão.

────────────────────────
REGRA DE SEGURANÇA POÉTICA (ANTI-COLAPSO)
────────────────────────
Se houver conflito entre regras e a musicalidade ou naturalidade da letra,
PRIORIZE sempre:
→ coerência humana
→ fluidez poética
→ emoção verdadeira
Nunca quebre a música para obedecer regras de forma literal.

────────────────────────
REGRA DE DISTRIBUIÇÃO DA MENSAGEM ESPECIAL
────────────────────────
A mensagem especial do cliente:

Deve ser diluída ao longo dos VERSOS e da PONTE

Nunca pode ser despejada inteira ou fragmentada no refrão

O refrão deve resumir o sentimento, não repetir ou listar o conteúdo textual da mensagem especial.

────────────────────────
REGRA 11 — HOMENAGENS COLETIVAS (CRÍTICA)
────────────────────────

11.1 IDENTIFICAÇÃO DE HOMENAGEM COLETIVA

Considera-se homenagem coletiva quando o campo "Sobre quem" contém:

- Dois ou mais nomes (ex: "Lucas, Luan e Nayara")
- Termos coletivos implícitos (ex: "Amigos", "Filhos", "Família", "Irmãos", "Pais")

👉 Nesses casos, o homenageado NÃO é uma pessoa individual, mas um conjunto relacional.

11.2 REGRA DO REFRÃO PARA HOMENAGEM COLETIVA (OBRIGATÓRIA)

Quando o homenageado for coletivo, o refrão DEVE:

❌ NUNCA individualizar:
- Proibido citar apenas um nome
- Proibido usar "você" no singular
- Proibido tratar o grupo como uma pessoa só

✅ Usar construção coletiva explícita, como:
- "vocês"
- "meus filhos"
- "nós"
- "esse amor que construímos"
- "cada um de vocês"

────────────────────────
PERSPECTIVA DA MÚSICA (CRÍTICO)
────────────────────────
A música DEVE ser escrita como se o AUTOR estivesse CANTANDO DIRETAMENTE PARA a pessoa homenageada.

✅ CORRETO (Primeira pessoa → Segunda pessoa):
- "Eu te amo, [Nome]"
- "Você me ensinou a viver"
- "Eu sou grato por você"
- "Você é minha inspiração"
- "Eu quero que você saiba"
- "Você mudou minha vida"

❌ PROIBIDO (Descrição indireta):
- "Eu xonei nela" ou "Eu xonado nela" (use "Eu me apaixonei por você")
- "Ela é especial" (use "Você é especial")
- "Ele me ensinou" (use "Você me ensinou")
- "Dela eu aprendi" (use "De você eu aprendi")
- Qualquer frase que descreva a pessoa na terceira pessoa (ela, ele, dela, dele)
- NUNCA use "xonei", "xonado", "xone", "xona" ou qualquer variação

A música é uma DECLARAÇÃO DIRETA cantada PARA a pessoa homenageada, não uma descrição SOBRE ela.

────────────────────────
ESTRUTURA OBRIGATÓRIA
────────────────────────
[Verso 1] – Início da história (ordem cronológica, nunca começar com nome)
[Verso 2] – Memórias, cenas e gestos marcantes
[Pré-Refrão] – Elevação emocional
[Refrão] – Memorável, cantável, com o nome da pessoa homenageada
[Verso 3] – Fechamento da história
[Ponte] – Curta, íntima, espiritual
[Refrão Final] – Versão suave e emocional do refrão

FORMATO OBRIGATÓRIO: TODAS as seções devem começar com o marcador entre colchetes [ ].
Exemplos corretos: [Verso 1], [Verso 2], [Verso 3], [Pré-Refrão], [Refrão], [Ponte], [Refrão Final].
❌ PROIBIDO formato alternativo: "Verso 1:", "Refrão Final:", "Ponte:" (sem colchetes)

${isCollective ? `⚠️ ATENÇÃO: HOMENAGEM COLETIVA DETECTADA
Esta é uma homenagem COLETIVA (${aboutWho}).
O refrão DEVE usar construção coletiva ("vocês", "meus filhos", "nós", etc.).
❌ PROIBIDO usar "você" no singular ou citar apenas um nome no refrão.` : ''}

────────────────────────
CHECKLIST FINAL
────────────────────────
Antes de gerar a letra, verifique:

✅ A estrutura obrigatória está completa (9 seções na ordem correta)?
✅ O nome da pessoa homenageada aparece APENAS no refrão e refrão final?
✅ O refrão tem verbo explícito, sujeito identificável e frase poética completa?
✅ Não há listas de palavras, nomes ou conceitos em sequência?
✅ Não há gírias ou abreviações não permitidas?
✅ Todos os nomes próprios mencionados no quiz aparecem na letra?
✅ Os nomes de memórias/momentos/mensagem aparecem nos versos, não no refrão?
✅ A mensagem especial está diluída nos versos/ponte, não despejada no refrão?
${isCollective ? `✅ O refrão usa construção coletiva ("vocês", "meus filhos", etc.) e não "você" no singular?` : ''}
✅ A letra está dentro do limite de 4800 caracteres?
✅ Todos os números estão escritos por extenso?
✅ A linguagem é poética, natural e não coloquial?

────────────────────────
ESTILO
────────────────────────
- Idioma: ${language}
- Estilo musical: ${styleTxt}
- Tom emocional: ${emotionalTone}
- Linguagem humanizada, nunca robótica.
- Use cenas vívidas (gestos, cheiros, momentos marcantes).
- Integre datas e lugares de forma natural.

────────────────────────
PERSPECTIVA E GÊNERO (CRÍTICO)
────────────────────────
A música DEVE ser escrita como se o AUTOR estivesse CANTANDO DIRETAMENTE PARA a pessoa homenageada.

✅ CORRETO (Primeira pessoa → Segunda pessoa):
- "Eu te amo, [Nome]"
- "Você me ensinou a viver"
- "Eu sou grato por você"
- "Você é minha inspiração"

❌ PROIBIDO (Descrição indireta):
- "Eu xonei nela" ou "Eu xonado nela" (use "Eu me apaixonei por você")
- "Ela é especial" (use "Você é especial")
- "Ele me ensinou" (use "Você me ensinou")
- Qualquer frase que descreva a pessoa na terceira pessoa (ela, ele, dela, dele)
- NUNCA use "xonei", "xonado", "xone", "xona" ou qualquer variação

Use declaração direta em segunda pessoa ("você").
Detecte automaticamente o gênero da pessoa homenageada através do contexto.
Use pronomes, adjetivos e verbos coerentes com o gênero detectado.
❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.
Priorize linguagem natural. Evite estruturas artificiais.

────────────────────────
FORMATO DE RESPOSTA
────────────────────────
Retorne APENAS JSON válido no formato:

{
  "title": "string",
  "lyrics": "string"
}

Nenhuma explicação fora do JSON.

${custom_instructions ? `\n────────────────────────\nINSTRUÇÕES ADICIONAIS DO ADMIN\n────────────────────────\n${custom_instructions}\n` : ''}`;

    const userPrompt = `Criar música de homenagem cinematográfica com base na história real do cliente:

⚠️ IMPORTANTE: Esta música é uma DECLARAÇÃO DIRETA do autor para ${aboutWho}.
Escreva como se você estivesse falando DIRETAMENTE com ${aboutWho}, usando:
- Primeira pessoa (eu, me, meu) para o autor
- Segunda pessoa (você, te, teu, sua) para ${aboutWho}
- ❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir a ${aboutWho}
- ❌ NUNCA use "xonei", "xonado", "xone", "xona" ou qualquer variação

=============================
DADOS DA HISTÓRIA
=============================
${historySection}

=============================
OBJETIVO ESPECÍFICO
=============================
Emocionar profundamente ${aboutWho}, contando a história COMPLETA de forma cronológica e vívida, celebrando amor, fé, superação e gratidão.

Use TODOS os detalhes fornecidos acima. Inclua TUDO que foi descrito, sem omitir nenhum detalhe.`;

    console.log('⏳ Enviando requisição para OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openAIModel,
        max_completion_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    console.log('📥 Resposta OpenAI recebida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro OpenAI:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('API Key inválida. Verifique OPENAI_API_KEY.');
      } else if (response.status === 404) {
        throw new Error(`Modelo OpenAI não disponível: "${openAIModel}". Verifique acesso e o nome do modelo.`);
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns minutos.');
      } else if (response.status === 400) {
        throw new Error('Requisição inválida: ' + errorText);
      } else if (response.status === 500) {
        throw new Error('Erro interno do servidor OpenAI. Tente novamente.');
      }
      
      throw new Error(`Erro na API OpenAI: ${response.status} - ${errorText}`);
    }

    console.log('✅ Resposta recebida da OpenAI');
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('Resposta vazia da OpenAI');
    }
    
    const generatedText = data.choices[0].message.content;
    
    let lyricsJson;
    try {
      // Limpar markdown se houver
      let cleanText = generatedText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      }
      
      lyricsJson = JSON.parse(cleanText);
      console.log('✅ JSON parseado com sucesso');
      
      // Validar estrutura obrigatória
      if (!lyricsJson.title || typeof lyricsJson.title !== 'string') {
        throw new Error('Campo "title" ausente ou inválido');
      }
      
      if (!lyricsJson.lyrics || typeof lyricsJson.lyrics !== 'string') {
        throw new Error('Campo "lyrics" ausente ou inválido');
      }
      
      // Converter formato de lyrics string para verses array
      const verses = parseLyricsString(lyricsJson.lyrics);
      
      if (verses.length === 0) {
        throw new Error('Nenhuma seção de letra encontrada após parsing');
      }
      
      // Criar objeto lyrics no formato esperado pelo frontend
      const lyrics = {
        title: lyricsJson.title,
        verses: verses,
        style: styleTxt,
        language: language,
        tone: emotionalTone
      };
      
      console.log('✅ Letra validada e convertida com sucesso:', {
        title: lyrics.title,
        verses_count: lyrics.verses.length,
        style: lyrics.style,
        language: lyrics.language,
        tone: lyrics.tone
      });

    // Log da geração
    await supabase.from('admin_logs').insert({
      admin_user_id: user.id,
      action: 'generate_lyrics',
      target_table: 'admin_generation',
      changes: { quiz_data, custom_instructions, lyrics }
    });

    return new Response(JSON.stringify({ lyrics }), {
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
    } catch (e: any) {
      console.error('❌ Erro ao processar resposta:', e);
      console.error('📄 Conteúdo original:', generatedText);
      throw new Error(`Erro ao processar resposta da IA: ${e.message}`);
    }

  } catch (error: any) {
    console.error('Erro em admin-generate-lyrics:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro desconhecido ao gerar letra',
      success: false
    }), {
      status: 200,
      headers: { ...secureHeaders, 'Content-Type': 'application/json' },
    });
  }
});
