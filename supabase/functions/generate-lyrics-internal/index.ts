import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Headers simplificados (sem rate limiting)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Função para converter string de lyrics formatada em array de verses
function parseLyricsString(lyricsString: string): Array<{ type: string; text: string }> {
  if (!lyricsString || typeof lyricsString !== 'string') {
    console.error('❌ parseLyricsString: lyricsString inválido:', typeof lyricsString, lyricsString);
    return [];
  }
  
  const verses: Array<{ type: string; text: string }> = [];
  
  try {
    // Tentar múltiplos padrões de parsing
    
    // Padrão 1: [Verso 1], [Refrão], etc. (padrão principal)
    const pattern1 = /\[(Verso\s*\d*|Pré-Refrão|Refrão(?:\s*Final)?|Ponte|Intro|Outro)\s*\](.*?)(?=\[(?:Verso|Pré-Refrão|Refrão|Ponte|Intro|Outro)\s*\d*\]|$)/gis;
    let match1;
    let foundPattern1 = false;
    
    while ((match1 = pattern1.exec(lyricsString)) !== null) {
      foundPattern1 = true;
      const sectionType = match1[1].trim();
      let content = (match1[2] || '').trim();
      
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
      } else if (sectionType.match(/Intro/i)) {
        type = 'verse';
      } else if (sectionType.match(/Outro/i)) {
        type = 'verse';
      } else {
        continue;
      }
      
      // Limpar conteúdo
      content = content.replace(/^\n+|\n+$/g, '').trim();
      
      if (content && content.length > 0) {
        verses.push({ type, text: content });
      }
    }
    
    // Se encontrou seções com padrão 1, retornar
    if (verses.length > 0) {
      console.log('✅ Parse usando padrão 1 (marcadores [Verso], [Refrão], etc.)');
      return verses;
    }
    
    // Padrão 2: Dividir por linhas que começam com [Verso], [Refrão], etc.
    if (!foundPattern1) {
      console.log('⚠️ Padrão 1 não encontrou seções, tentando padrão 2...');
      const sections = lyricsString.split(/(?=\[(?:Verso|Pré-Refrão|Refrão|Ponte|Refrão Final|Intro|Outro)\s*\d*\])/i);
      
      for (const section of sections) {
        if (!section || !section.trim()) continue;
        
        try {
          const match = section.match(/\[(Verso\s*\d*|Pré-Refrão|Refrão(?:\s*Final)?|Ponte|Intro|Outro)\s*\](.*)/is);
          if (!match || !match[1] || !match[2]) continue;
          
          const sectionType = match[1].trim();
          let content = match[2].trim();
          
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
            continue;
          }
          
          content = content.replace(/^\n+|\n+$/g, '').trim();
          
          if (content) {
            verses.push({ type, text: content });
          }
        } catch (sectionError) {
          console.warn('⚠️ Erro ao processar seção (não crítico):', sectionError);
          continue;
        }
      }
      
      if (verses.length > 0) {
        console.log('✅ Parse usando padrão 2 (split por marcadores)');
        return verses;
      }
    }
    
    // Se nenhum padrão funcionou, logar para debug
    console.warn('⚠️ Nenhum padrão de parsing encontrou seções. Letra pode estar em formato diferente.');
    console.warn('⚠️ Primeiros 500 caracteres da letra:', lyricsString.substring(0, 500));
    
  } catch (parseError) {
    console.error('❌ Erro ao fazer parse da letra:', parseError);
    throw parseError;
  }
  
  return verses;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Variáveis no escopo superior para uso no catch
  let job_id: string | undefined;
  let isPreview = false;
  
  try {
    console.log('=== Generate Lyrics Internal Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Variáveis de ambiente SUPABASE_URL e SERVICE_ROLE_KEY são obrigatórias');
    }
    
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      throw new Error(`Erro ao fazer parse do body da requisição: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    job_id = requestBody?.job_id;
    const previewQuiz = requestBody?.quiz;
    isPreview = Boolean(requestBody?.preview || (previewQuiz && !job_id));

    if (!job_id && !isPreview) {
      throw new Error('job_id é obrigatório no body da requisição');
    }

    let quiz: any = null;
    if (isPreview) {
      if (!previewQuiz) {
        throw new Error('quiz é obrigatório quando preview=true');
      }
      console.log('🧪 Gerando letra em modo preview (sem persistência)');
      quiz = previewQuiz;
    } else {
      console.log('Processing job:', job_id);

      // Buscar job com quiz
      const { data: job, error: jobError } = await supabaseClient
        .from('jobs')
        .select('*, quizzes(*)')
        .eq('id', job_id)
        .single();

      if (jobError || !job) {
        throw new Error(`Job não encontrado: ${jobError?.message}`);
      }

      // quizzes(*) retorna um array, pegar o primeiro elemento
      console.log('✅ Job encontrado, verificando quiz...', { 
        hasQuizzes: !!job.quizzes, 
        isArray: Array.isArray(job.quizzes),
        length: Array.isArray(job.quizzes) ? job.quizzes.length : 'N/A'
      });
      
      quiz = Array.isArray(job.quizzes) ? job.quizzes[0] : job.quizzes;
      if (!quiz) {
        console.error('❌ Quiz não encontrado:', { jobId: job.id, quizzes: job.quizzes });
        throw new Error('Quiz não encontrado para este job');
      }

      // Atualizar status para processing (não importa quantas vezes regenerar)
      await supabaseClient
        .from('jobs')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);
    }

    console.log('✅ Quiz encontrado:', { 
      hasAboutWho: !!quiz?.about_who,
      hasRelationship: !!quiz?.relationship,
      hasStyle: !!quiz?.style
    });

    if (!quiz?.about_who || !quiz?.relationship || !quiz?.style) {
      throw new Error('Dados do quiz incompletos para gerar a letra');
    }

    // Preparar prompts para OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const openAIModel = (Deno.env.get('OPENAI_MODEL') || '').trim() || 'gpt-4o-mini';
    
    if (!openAIApiKey || typeof openAIApiKey !== 'string' || openAIApiKey.trim().length === 0) {
      console.error('❌ OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY não configurada. Configure em Settings > Functions no Supabase.');
    }

    // Chaves da OpenAI começam com sk- ou sk-proj-. Outras chaves (ex: Lovable) não funcionam.
    const trimmedKey = openAIApiKey.trim();
    if (!trimmedKey.startsWith('sk-')) {
      console.error('❌ OPENAI_API_KEY com formato inválido. Chaves OpenAI começam com sk-');
      throw new Error('OPENAI_API_KEY deve ser uma chave da OpenAI (começa com sk-). A chave configurada parece ser de outro serviço. Obtenha em platform.openai.com/api-keys');
    }

    console.log('🔑 OpenAI API Key presente:', trimmedKey.substring(0, 10) + '...');
    console.log('🤖 OpenAI model em uso:', openAIModel);

    // Tom emocional PADRÃO: amor profundo, calma, lenta, muito emocionante (com fallback)
    const emotionalTone = (quiz.desired_tone && String(quiz.desired_tone).trim()) || 'amor profundo, calma, lenta, profundamente emocionante';
    
    // Mapear códigos de idioma para nomes completos
    let language = quiz.language || 'português';
    if (language === 'pt') language = 'português';
    if (language === 'en') language = 'inglês';
    if (language === 'es') language = 'espanhol';

    // Defaults por idioma
    const i18nDefaults = {
      aboutWho: language === 'inglês' ? 'a special person' : language === 'espanhol' ? 'una persona especial' : 'uma pessoa especial',
      relationship: language === 'inglês' ? 'special relationship' : language === 'espanhol' ? 'relación especial' : 'relação especial',
      occasion: language === 'inglês' ? 'special moment' : language === 'espanhol' ? 'momento especial' : 'momento especial',
      qualities: '',
      moments: '',
      memories: '',
      message: '',
      style: 'Pop',
    } as const;

    const norm = (v: any, fallback: string) => {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'string') {
        const s = v.trim();
        return s.length ? s : fallback;
      }
      try { return JSON.stringify(v); } catch { return fallback; }
    };

    const sanitize = (text: string) => {
      if (!text || typeof text !== 'string') return '';
      return text
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    };

    const truncate = (text: string, max: number) => {
      if (!text || typeof text !== 'string') return '';
      return text.slice(0, max);
    };

    // Função para expandir abreviações comuns
    const expandAbbreviations = (text: string): string => {
      if (!text || typeof text !== 'string') return text;
      
      // Dicionário corrigido: apenas abreviações reais, sem ambiguidade, sem uma letra
      const abbreviations: Record<string, string> = {
        // Abreviações comuns de 2+ caracteres
        'vc': 'você',
        'vcs': 'vocês',
        'pq': 'porque',
        'tb': 'também',
        'tbm': 'também',
        'blz': 'beleza',
        'tá': 'está',
        'né': 'não é',
        'pra': 'para',
        'pro': 'para o',
        'pros': 'para os',
        'pras': 'para as',
        'naum': 'não',
        'nao': 'não',
        'mt': 'muito',
        'mtos': 'muitos',
        'mtas': 'muitas',
        'td': 'tudo',
        'tds': 'todos',
        'tdas': 'todas',
        'hj': 'hoje',
        'amanha': 'amanhã',
        'cmg': 'comigo',
        'ctg': 'contigo',
        'cm': 'com',
        'p/': 'para',
        'c/': 'com',
        'd+': 'demais',
        'dps': 'depois',
        'vlw': 'valeu',
        'obg': 'obrigado',
        'obgd': 'obrigado',
        'obgda': 'obrigada',
        'pf': 'por favor',
        'pfv': 'por favor',
        'pfvr': 'por favor',
        'tmj': 'tamo junto',
        'flw': 'falou',
        'eh': 'é',
      };
      
      let expanded = text;
      
      // Substituir abreviações (case-insensitive, com word boundaries)
      // Ordenar por tamanho (maior primeiro) para evitar substituições parciais
      const sortedEntries = Object.entries(abbreviations).sort((a, b) => b[0].length - a[0].length);
      
      sortedEntries.forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        expanded = expanded.replace(regex, full);
      });
      
      return expanded;
    };

    const stringifyMemories = (mem: any): string => {
      if (!mem) return i18nDefaults.memories;
      try {
        if (Array.isArray(mem)) return mem.filter(Boolean).join('; ');
        if (typeof mem === 'string') return mem.trim() || i18nDefaults.memories;
        const parsed = typeof mem === 'object' ? mem : JSON.parse(String(mem));
        if (Array.isArray(parsed)) return parsed.filter(Boolean).join('; ');
        return JSON.stringify(parsed);
      } catch { return String(mem); }
    };

    // Validar que quiz existe e tem propriedades necessárias
    if (!quiz || typeof quiz !== 'object') {
      console.error('❌ Quiz inválido:', quiz);
      throw new Error('Quiz inválido ou não encontrado');
    }

    // Aplicar expansão de abreviações ANTES de sanitize e truncate
    const aboutWho = truncate(sanitize(expandAbbreviations(norm(quiz?.about_who, i18nDefaults.aboutWho))), 120);
    const relationship = truncate(sanitize(expandAbbreviations(norm(quiz?.relationship, i18nDefaults.relationship))), 120);
    const occasion = truncate(sanitize(expandAbbreviations(norm(quiz?.occasion, i18nDefaults.occasion))), 120);
    const qualities = truncate(sanitize(expandAbbreviations(norm(quiz?.qualities, i18nDefaults.qualities))), 200);
    const keyMoments = truncate(sanitize(expandAbbreviations(norm(quiz?.key_moments, i18nDefaults.moments))), 300);
    const memoriesTxt = truncate(sanitize(expandAbbreviations(stringifyMemories(quiz?.memories))), 400);
    // Novo padrão: message pode ter até 2500 caracteres (contexto consolidado)
    const messageTxt = truncate(sanitize(expandAbbreviations(norm(quiz?.message, i18nDefaults.message))), 2500);

    const STYLE_LABELS_MAP: Record<string, string> = {
      romantico: 'Romântico',
      gospel: 'Gospel',
      forro: 'Forró',
      sertanejo: 'Sertanejo',
      pagode: 'Pagode',
      sertanejo_uni: 'Sertanejo Universitário',
      funk: 'Funk',
      reggae: 'Reggae',
      pop: 'Pop',
      rock: 'Rock',
      piseiro: 'Piseiro',
      mpb: 'MPB',
      trap: 'Trap',
    };

    const mapStyleLabel = (value?: string): string => {
      const raw = sanitize(expandAbbreviations(norm(value, i18nDefaults.style)));
      if (!raw) return i18nDefaults.style;
      return STYLE_LABELS_MAP[raw] || raw;
    };

    const styleTxt = truncate(mapStyleLabel(quiz?.style), 60);

    const vocalGender = typeof quiz?.vocal_gender === 'string' ? quiz.vocal_gender : '';
    const vocalGenderLabel =
      vocalGender === 'm'
        ? 'masculina'
        : vocalGender === 'f'
          ? 'feminina'
          : 'não informado';

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
    
    // Detectar se a pessoa homenageada é mulher ou homem baseado no relacionamento
    const isWoman = (rel: string): boolean => {
      if (!rel) return false;
      const relLower = rel.toLowerCase();
      const womanKeywords = [
        'esposa', 'mulher', 'namorada', 'noiva', 'companheira', 'parceira',
        'mãe', 'mãezinha', 'mamãe', 'mamã', 'mamae',
        'filha', 'filhinha',
        'irmã', 'irmazinha',
        'avó', 'avozinha', 'vovó', 'vovozinha',
        'tia', 'tiazinha',
        'sobrinha', 'prima', 'cunhada', 'nora', 'sogra', 'sogrinha',
        'amiga', 'amiguinha'
      ];
      return womanKeywords.some(keyword => relLower.includes(keyword));
    };
    
    const isMan = (rel: string): boolean => {
      if (!rel) return false;
      const relLower = rel.toLowerCase();
      const manKeywords = [
        'esposo', 'marido', 'namorado', 'noivo', 'companheiro', 'parceiro',
        'pai', 'paizinho', 'papai', 'papá', 'papai',
        'filho', 'filhinho',
        'irmão', 'irmãozinho',
        'avô', 'avozinho', 'vovô', 'vovozinho',
        'tio', 'tiozinho',
        'sobrinho', 'primo', 'cunhado', 'genro', 'sogro', 'sogrinho',
        'amigo', 'amiguinho'
      ];
      return manKeywords.some(keyword => relLower.includes(keyword));
    };
    
    const isWomanHomenageada = isWoman(relationship);
    const isManHomenageado = isMan(relationship);

    // Detectar gênero de quem escreve (autor) a partir de pistas de primeira pessoa
    const detectAuthorGender = (text: string): 'woman' | 'man' | 'unknown' => {
      if (!text) return 'unknown';
      const textLower = text.toLowerCase();
      let womanScore = 0;
      let manScore = 0;
      
      const womanMarkers = [
        'sou mãe', 'sou mae', 'sou a mãe', 'sou sua mãe', 'sou sua mae',
        'sou esposa', 'sou sua esposa', 'sou a esposa',
        'sou namorada', 'sou sua namorada', 'sou a namorada',
        'sou noiva', 'sou sua noiva',
        'sou filha', 'sou filha dele', 'sou filha dela',
        'sou tia', 'sou madrinha',
        'grata', 'obrigada', 'apaixonada', 'sou apaixonada'
      ];
      
      const manMarkers = [
        'sou pai', 'sou o pai', 'sou seu pai', 'sou seu pae',
        'sou marido', 'sou seu marido', 'sou o marido',
        'sou namorado', 'sou seu namorado', 'sou o namorado',
        'sou noivo', 'sou seu noivo',
        'sou filho', 'sou filho dela', 'sou filho dele',
        'sou tio', 'sou padrinho',
        'grato', 'obrigado', 'apaixonado', 'sou apaixonado', 'sou esposo', 'sou seu esposo'
      ];
      
      womanMarkers.forEach(marker => {
        const matches = (textLower.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        womanScore += matches * 2;
      });
      
      manMarkers.forEach(marker => {
        const matches = (textLower.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        manScore += matches * 2;
      });
      
      if (womanScore > manScore && womanScore > 0) return 'woman';
      if (manScore > womanScore && manScore > 0) return 'man';
      return 'unknown';
    };
    
    // Analisar TODO o texto do quiz para detectar gênero do autor
    const allQuizText = `${relationship} ${aboutWho} ${qualities} ${keyMoments} ${memoriesTxt} ${messageTxt}`;
    const authorGender = detectAuthorGender(allQuizText);
    const isAuthorWoman = authorGender === 'woman';
    const isAuthorMan = authorGender === 'man';

    // Extrair todos os nomes mencionados no quiz
    const extractNames = (text: string): string[] => {
      if (!text) return [];
      const names = new Set<string>();
      
      // Padrões melhorados para capturar nomes
      const namePatterns = [
        // Nomes após palavras-chave (filhos, filhas, netos, etc.)
        /(?:filhos?|filhas?|netos?|netas?|sobrinhos?|sobrinhas?|primos?|primas?|irmãos?|irmãs?|pais?|mães?|avós?|avôs?|tios?|tias?|cunhados?|cunhadas?|genros?|noras?)[\s:]*([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*)/gi,
        
        // Nomes em listas (João, Maria e Pedro)
        /(?:^|[\s,;])([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*)(?:\s*[,;]\s*|\s+e\s+)/g,
        
        // Nomes após dois pontos
        /:\s*([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*)/g,
        
        // Nomes padrão (início de palavra ou após espaço/pontuação)
        /(?:^|[\s:,\-])([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*)/g,
        
        // Nomes entre aspas
        /"([A-ZÁÉÍÓÚÂÊÔÇ][^"]+)"|'([A-ZÁÉÍÓÚÂÊÔÇ][^']+)'/g,
        
        // Nomes compostos com hífen
        /([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+-[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)/g,
      ];
      
      // Buscar nomes em todos os campos EXCETO relationship (para evitar capturar palavras de relacionamento como nomes)
      const allText = `${aboutWho} ${occasion} ${qualities} ${keyMoments} ${memoriesTxt} ${messageTxt} ${text}`;
      
      namePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(allText)) !== null) {
          const name = (match[1] || match[2] || match[0]).trim();
          
          // Lista expandida de palavras comuns incluindo palavras de relacionamento
          const commonWords = [
            'SOBRE', 'QUEM', 'RELACIONAMENTO', 'OCASIÃO', 'QUALIDADES', 'MOMENTOS', 
            'MEMÓRIAS', 'MENSAGEM', 'PRINCIPAL', 'COMPARTILHADAS', 'ESPECIAIS', 'CHAVE', 
            'DADOS', 'HISTÓRIA', 'OBJETIVO', 'REQUISITOS', 'CRÍTICOS', 'ESTRUTURA', 
            'FIDELIDADE', 'TOTAL', 'ESTILO', 'CONTEÚDO', 'LIMITE', 'Verso', 'Pré-Refrão', 
            'Refrão', 'Ponte', 'Final', 'FILHOS', 'FILHAS', 'NETOS', 'NETAS', 'SOBRINHOS',
            'SOBRINHAS', 'PRIMOS', 'PRIMAS', 'IRMÃOS', 'IRMÃS', 'PAIS', 'MÃES', 'AVÓS',
            'AVÔS', 'TIOS', 'TIAS', 'CUNHADOS', 'CUNHADAS', 'GENROS', 'NORAS',
            // Palavras de relacionamento que NÃO devem ser tratadas como nomes
            'ESPOSO', 'ESPOSA', 'MARIDO', 'MULHER', 'NAMORADO', 'NAMORADA', 'NOIVO', 'NOIVA',
            'COMPANHEIRO', 'COMPANHEIRA', 'PARCEIRO', 'PARCEIRA', 'AMIGO', 'AMIGA', 'COLEGA'
          ];
          
          if (name.length > 2 && 
              !commonWords.includes(name.toUpperCase()) && 
              !/^\d+$/.test(name) &&
              !name.match(/^(E|A|O|DE|DA|DO|DOS|DAS|EM|NO|NA|NOS|NAS|PARA|COM|POR)$/i)) {
            names.add(name);
          }
        }
      });
      
      return Array.from(names).filter(n => n.length > 1);
    };

    // Coletar todos os nomes de todos os campos (EXCETO relationship para evitar capturar palavras de relacionamento)
    const allNames = extractNames(`${aboutWho} ${occasion} ${qualities} ${keyMoments} ${memoriesTxt} ${messageTxt}`);
    const uniqueNames = Array.from(new Set(allNames.map((n) => n.trim()))).filter(Boolean);
    const namesList = uniqueNames.length > 0 ? uniqueNames.join(', ') : 'nenhum nome específico mencionado';
    
    // ✅ Regra solicitada: citar apenas UMA vez o(s) nome(s) da pessoa homenageada (about_who)
    const hasExplicitAboutWho = quiz?.about_who && typeof quiz.about_who === 'string' && quiz.about_who.trim().length > 0;
    const honoredNamesRaw = hasExplicitAboutWho ? extractNames(aboutWho) : [];
    const honoredNames = Array.from(new Set(honoredNamesRaw.map((n) => n.trim()))).filter(Boolean);
    const honoredNamesList =
      hasExplicitAboutWho && honoredNames.length > 0
        ? honoredNames.join(', ')
        : hasExplicitAboutWho
          ? aboutWho
          : '';

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
REGRAS ABSOLUTAS (NUNCA VIOLAR)
────────────────────────

❌ PROIBIÇÕES ABSOLUTAS:
- PROIBIDO usar "xonei", "xonado", "xone", "xona" ou QUALQUER variação (maiúsculas, minúsculas, com ou sem acentos).
- PROIBIDO usar "amante", exceto se o cliente mencionar explicitamente.
- PROIBIDO inventar fatos, datas, pessoas, locais ou eventos não mencionados no quiz.
- PROIBIDO listar palavras, conceitos, qualidades ou nomes em sequência (em qualquer parte da letra).
- PROIBIDO usar gírias ou abreviações não permitidas.
- PROIBIDO pular ou alterar a ordem da estrutura obrigatória.
- PROIBIDO usar terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.

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
REGRAS CRÍTICAS DO REFRÃO
────────────────────────

⚠️ O REFRÃO É A PARTE MAIS IMPORTANTE DA MÚSICA. Siga TODAS estas regras:

1. NOME DA PESSOA HOMENAGEADA (ONDE APARECE):
   - O nome da pessoa homenageada (campo "about_who") deve aparecer APENAS no REFRÃO e no REFRÃO FINAL.
   - ❌ É PROIBIDO citar esse nome em versos, pré-refrão ou ponte.
   - Nessas partes, utilize apenas pronomes: "você", "te", "teu/tua", "seu/sua".

2. DIGNIDADE DO NOME (COMO INTEGRAR):
   - O nome deve ser o núcleo emocional da frase.
   - Deve estar integrado à oração principal, nunca isolado.
   - ❌ É PROIBIDO colocar o nome entre vírgulas, listas ou sequências de palavras.
   - O nome deve carregar sentido, não apenas ocupar espaço.

3. FORMA POÉTICA OBRIGATÓRIA:
   - O refrão deve ser UMA FRASE POÉTICA COMPLETA, emocional, fluida e fácil de cantar.
   - ❌ É PROIBIDO listar palavras, nomes ou conceitos em sequência.
   - O nome da pessoa homenageada deve estar INTEGRADO naturalmente à frase do refrão.

4. ESTRUTURA SINTÁTICA OBRIGATÓRIA:
   - Todo refrão e refrão final DEVEM conter:
     * Pelo menos UM verbo explícito
     * Um sujeito identificável
     * Uma frase poética completa, com sentido do início ao fim
   - ❌ É PROIBIDO refrão formado por:
     * listas de palavras
     * nomes separados por vírgula
     * conceitos soltos sem verbo
   - Se não houver verbo, o refrão é considerado inválido.

5. ESTRUTURA NARRATIVA:
   - O refrão deve resumir o sentimento principal, não repetir ou listar o conteúdo textual da mensagem especial.
   - A mensagem especial do cliente deve ser diluída ao longo dos VERSOS e da PONTE.
   - ❌ Nunca despeje a mensagem especial inteira ou fragmentada no refrão.

6. HOMENAGENS COLETIVAS:
   ${isCollective ? `⚠️ HOMENAGEM COLETIVA DETECTADA (` + aboutWho + `):
   - ❌ NUNCA individualizar: proibido citar apenas um nome, usar "você" no singular, ou tratar o grupo como uma pessoa só.
   - ✅ Usar construção coletiva explícita: "vocês", "meus filhos", "nós", "esse amor que construímos", "cada um de vocês".` : `- Se o campo "Sobre quem" contém dois ou mais nomes ou termos coletivos (ex: "Amigos", "Filhos", "Família"):
     * ❌ NUNCA individualizar: proibido citar apenas um nome, usar "você" no singular, ou tratar o grupo como uma pessoa só.
     * ✅ Usar construção coletiva explícita: "vocês", "meus filhos", "nós", "esse amor que construímos", "cada um de vocês".`}

7. CARGA EMOCIONAL:
   - O refrão deve ser memorável, cantável e emocionalmente impactante.
   - Priorize fluidez, emoção verdadeira e musicalidade.

────────────────────────
REGRAS DE CONTEÚDO
────────────────────────

1. USO DOS DETALHES (SEMÂNTICO, NÃO LITERAL):
   - A letra deve conter TODA a história do cliente mencionada no formulário.
   - Use o máximo possível dos detalhes fornecidos na mensagem/história do cliente.
   - Traga cenas específicas e vívidas (ex.: "tombo de bicicleta", "fogão a lenha", "cheiro da cozinha", "nomes dos filhos").
   - Qualidades devem ser transformadas em AÇÕES, ATITUDES ou IMAGENS poéticas.
   - ❌ Nunca liste palavras, qualidades ou conceitos literalmente.

2. PROIBIÇÃO DE INVENÇÃO:
   - ❌ Nunca invente fatos, datas, pessoas, locais ou eventos que não estejam explicitamente mencionados no quiz.

3. NOMES PRÓPRIOS:
   - Todos os NOMES PRÓPRIOS citados no quiz (pessoas, filhos, parentes, pets, locais específicos) DEVEM aparecer na letra de forma natural.
   - Conceitos, atributos, qualidades e sentimentos NÃO são nomes próprios.

4. NOMES DE MEMÓRIAS/MOMENTOS/MENSAGEM:
   - Os nomes próprios mencionados em memórias, momentos importantes e mensagem especial devem aparecer nos VERSOS (Verso 1, Verso 2 ou Verso 3), NUNCA no refrão.
   - Coloque os nomes na ordem em que são mencionados no texto do quiz.
   - Cada nome deve aparecer em uma frase completa que contextualize seu papel na história.
   - Integre os nomes naturalmente na narrativa cronológica da letra.
   - Se houver muitos nomes, distribua-os entre os versos, sem concentrar vários nomes em um único verso.

────────────────────────
REGRAS DE FORMA
────────────────────────

1. ESTRUTURA OBRIGATÓRIA (ordem fixa):
   - Deve ser seguida EXATAMENTE nesta ordem:
     1. [Verso 1] – variável (4+ linhas, conforme necessário)
     2. [Pré-Refrão] – variável (4-8 linhas)
     3. [Refrão] – variável (8+ linhas, memorável e consistente)
     4. [Verso 2] – variável (4+ linhas, conforme necessário para contar a história)
     5. [Verso 3] – variável (4+ linhas, conforme necessário para completar a história)
     6. [Pré-Refrão] – repetir ou criar variação
     7. [Refrão] – repetir exato
     8. [Ponte] – variável (3-6 linhas)
     9. [Refrão Final] – versão suave e emocionante do refrão (pode ser modificado)
   - ❌ PROIBIDO: pular qualquer seção, alterar a ordem, adicionar seções extras, omitir marcadores.
   - ✅ OBRIGATÓRIO: usar EXATAMENTE os marcadores acima (com maiúsculas e acentos corretos).
   - ✅ FORMATO OBRIGATÓRIO: TODAS as seções devem começar com o marcador entre colchetes [ ].
     Exemplos corretos: [Verso 1], [Verso 2], [Verso 3], [Pré-Refrão], [Refrão], [Ponte], [Refrão Final].
     ❌ PROIBIDO formato alternativo: "Verso 1:", "Refrão Final:", "Ponte:" (sem colchetes).

2. TAMANHO:
   - Máximo de 4800 caracteres (para caber no limite de 5000 do Suno com folga).

3. REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
   - Números sempre por extenso: "1" → "um", "2" → "dois", "10" → "dez", "100" → "cem", etc.
   - Números com vírgula sempre por extenso: "1,5" → "um vírgula cinco", "2,3" → "dois vírgula três", etc.
   - Unidades sempre por extenso: "km" → "quilômetros", "kg" → "quilogramas", "m" → "metros", etc.
   - NUNCA use números ou unidades abreviadas na letra.

4. ESTILO DE ESCRITA:
   - Rimas naturais, sem parecer forçado.
   - Cadência cantável, fluida e musical.
   - Evite clichês vazios ("amor verdadeiro demais", "para sempre ao seu lado" genérico) sem contexto.
   - Prefira imagens vivas e concretas (cheiros, cenas, gestos, coisas que a pessoa realmente viveu).
   - Traga memórias específicas mencionadas no formulário com sutileza.
   - Tom maduro, íntimo, verdadeiro (nada infantilizado se a história for adulta).

────────────────────────
REGRAS DE LINGUAGEM
────────────────────────

1. PROIBIÇÃO DE GÍRIAS E ABREVIAÇÕES:
   - ❌ PROIBIDO usar gírias, abreviações ou linguagem coloquial informal.
   - ❌ PROIBIDO usar: "vc", "pq", "tb", "tbm", "vcs", "blz", "tá", "né", "pra", "pro", etc.
   - ✅ SEMPRE use palavras completas: "você", "porque", "também", "está", "não é", "para", etc.
   - Use linguagem poética, natural, clara e não coloquial.
   - Evite coloquialismos, mas mantenha naturalidade e fluidez poética.

2. REGRA DE APELIDOS CARINHOSOS:
   - Se o quiz mencionar um apelido carinhoso:
     * Ele NÃO é tratado como gíria proibida.
     * Deve ser usado apenas se explicitamente citado pelo cliente.
     * Deve aparecer contextualizado emocionalmente (carinho, intimidade, afeto).
     * ❌ É PROIBIDO usar apelido como palavra solta ou em listas.
     * Preferência de uso: VERSOS, nunca como elemento jogado no refrão.

3. PROIBIÇÃO DE LISTAS (CRÍTICO):
   - ❌ É PROIBIDO listar palavras, conceitos, qualidades ou nomes em sequência, em qualquer parte da letra.
   - Toda ideia deve estar integrada em frases completas, com verbo, contexto e sentido narrativo.
   - ❌ PROIBIDO: "João, Maria, Pedro" ou "amor, carinho, dedicação"
   - ✅ PERMITIDO: "João sempre esteve ao meu lado, Maria trouxe alegria, e Pedro ensinou valores"

────────────────────────
REGRAS DE CONTEXTO
────────────────────────

1. PERSPECTIVA E GÊNERO:
${isWomanHomenageada ? `   - A pessoa homenageada é MULHER.
   - A música deve ser escrita na PERSPECTIVA MASCULINA.
   - Um homem cantando DIRETAMENTE PARA uma mulher.
   - Use "eu" (homem) falando DIRETAMENTE com "você" (mulher).
   - ❌ NUNCA use "ela", "dela" - sempre use "você", "sua", "te".
   - Utilize adjetivos, pronomes e concordância no FEMININO.` : 
isManHomenageado ? `   - A pessoa homenageada é HOMEM.
   - A música deve ser escrita na PERSPECTIVA FEMININA.
   - Uma mulher cantando DIRETAMENTE PARA um homem.
   - Use "eu" (mulher) falando DIRETAMENTE com "você" (homem).
   - ❌ NUNCA use "ele", "dele" - sempre use "você", "seu", "te".
   - Utilize adjetivos, pronomes e concordância no MASCULINO.` : 
`   - Gênero desconhecido.
   - Use declaração direta em segunda pessoa ("você").
   - ❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.`}

2. CONCORDÂNCIA DO AUTOR:
   - Gênero detectado do autor: ${isAuthorWoman ? 'MULHER' : isAuthorMan ? 'HOMEM' : 'DESCONHECIDO'}
   - Se MULHER: use primeira pessoa feminina quando necessário (ex: "estou grata", "fiquei emocionada").
   - Se HOMEM: use primeira pessoa masculina quando necessário (ex: "estou grato", "fiquei emocionado").
   - Se DESCONHECIDO: mantenha primeira pessoa neutra.

3. REGRA DE PERSPECTIVA DIRETA (OBRIGATÓRIA):
   - A música é uma CONVERSA DIRETA do autor com a pessoa homenageada.
   - Use primeira pessoa (eu, me, meu) para o autor.
   - Use segunda pessoa (você, te, teu, sua) para a pessoa homenageada.
   - ❌ PROIBIDO usar terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.

4. VOZ INFORMADA NO QUIZ:
   - Voz que vai cantar: ${vocalGenderLabel}
   - Se informado, mantenha concordância e perspectiva compatíveis com essa voz.

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
NOMES A INCLUIR
────────────────────────
${namesList}

${hasExplicitAboutWho ? `NOME(S) DA PESSOA HOMENAGEADA (APENAS NO REFRÃO): ${honoredNamesList}` : ''}

${isCollective ? `⚠️ ATENÇÃO: HOMENAGEM COLETIVA DETECTADA
Esta é uma homenagem COLETIVA (` + aboutWho + `).
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
${isCollective ? '✅ O refrão usa construção coletiva ("vocês", "meus filhos", etc.) e não "você" no singular?' : ''}
✅ A letra está dentro do limite de 4800 caracteres?
✅ Todos os números e unidades estão escritos por extenso?
✅ A linguagem é poética, natural, reverente e não coloquial?


────────────────────────
FORMATO DE RESPOSTA
────────────────────────
Retorne APENAS JSON válido no formato:

{
  "title": "string",
  "lyrics": "string"
}

CRÍTICO: Retorne APENAS os campos "title" e "lyrics". Nada mais.
Nenhuma explicação fora do JSON.`;

    const relationshipSentence = relationship
      ? `Esta música é sobre ${aboutWho}, que é ${relationship}.`
      : `Esta música é sobre ${aboutWho}.`;
    const occasionLine = occasion ? `- Ocasião: ${occasion}` : '';
    const qualitiesLine = qualities ? `- Qualidades especiais: ${qualities}` : '';
    const keyMomentsBlock = keyMoments ? `MOMENTOS IMPORTANTES:\n${keyMoments}\n\n` : '';
    const memoriesBlock = memoriesTxt ? `MEMÓRIAS COMPARTILHADAS:\n${memoriesTxt}\n\n` : '';

    // Quiz simplificado: apenas message preenchido (qualities, key_moments, memories vazios)
    const isSimplifiedQuiz = !qualities && !keyMoments && !memoriesTxt && !!messageTxt;

    const historySection = isSimplifiedQuiz
      ? `=============================
HISTÓRIA E MENSAGEM DO CLIENTE
=============================
Todo o contexto, história, qualidades, memórias e mensagem estão abaixo. Use TUDO para criar a letra.

${relationshipSentence}
${occasion ? `Ocasião: ${occasion}\n` : ''}

HISTÓRIA/MENSAGEM/LETRA DO CLIENTE:
${messageTxt}`
      : `=============================
HISTÓRIA DO CLIENTE
=============================
${relationshipSentence}

CONTEXTO:
${occasionLine}
${qualitiesLine}

${keyMomentsBlock}${memoriesBlock}

MENSAGEM PRINCIPAL:
${messageTxt}`;

    const userPrompt = `Criar música de homenagem cinematográfica com base na história real do cliente:

⚠️ IMPORTANTE: Esta música é uma DECLARAÇÃO DIRETA do autor para ${aboutWho}.
Escreva como se você estivesse falando DIRETAMENTE com ${aboutWho}, usando:
- Primeira pessoa (eu, me, meu) para o autor
- Segunda pessoa (você, te, teu, sua) para ${aboutWho}
- ❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir a ${aboutWho}
- ❌ NUNCA use "xonei", "xonado", "xone", "xona" ou qualquer variação

${historySection}

=============================
NOMES MENCIONADOS NO QUIZ
=============================
NOMES A INCLUIR: ${namesList}
${hasExplicitAboutWho ? `NOME(S) DA PESSOA HOMENAGEADA (CITAR NO REFRÃO E REFRÃO FINAL): ${honoredNamesList}` : ''}

=============================
REQUISITOS DE INTEGRAÇÃO
=============================
- Integre TODAS essas informações de forma natural e contextualizada
- Cada nome mencionado deve aparecer em uma frase completa que explique seu papel na história
- Não liste informações soltas - sempre forneça contexto
- Mantenha um fluxo narrativo contínuo e coerente
- Use palavras de relacionamento (${relationship}) como DESCRIÇÕES, nunca como parte do nome
- NOMES PRÓPRIOS: Os nomes mencionados em memórias, momentos importantes e mensagem especial devem aparecer nos versos, na ordem em que são mencionados no quiz. Apenas o nome da pessoa homenageada (about_who) aparece no refrão.

=============================
LEMBRETE: ESTRUTURA OBRIGATÓRIA
=============================
⚠️ Siga EXATAMENTE a estrutura definida nas REGRAS DE FORMA do systemPrompt:
[Verso 1] → [Pré-Refrão] → [Refrão] → [Verso 2] → [Verso 3] → [Pré-Refrão] → [Refrão] → [Ponte] → [Refrão Final]

=============================
OBJETIVO ESPECÍFICO
=============================
Emocionar profundamente ${aboutWho}, contando a história COMPLETA de forma cronológica e vívida, celebrando amor, fé, superação e gratidão.

Use TODOS os detalhes fornecidos acima. Inclua TUDO que foi descrito, sem omitir nenhum detalhe.`;

    console.log(`📝 Chamando OpenAI (${openAIModel}) para gerar letra...`);
    console.log('🎵 Tom emocional:', emotionalTone);
    console.log('🎸 Estilo:', quiz?.style);
    console.log('🌍 Idioma do quiz:', quiz?.language);
    console.log('🌍 Idioma detectado:', language);
    console.log('📋 Dados completos do quiz:', JSON.stringify(quiz, null, 2));

    // Função de validação de coerência narrativa
    interface ValidationResult {
      isValid: boolean;
      errors: string[];
      warnings: string[];
    }

    const validateLyricsCoherence = (lyrics: string, quizData: any): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const lyricsLower = lyrics.toLowerCase();
      
      // 1. Verificar se há padrão "Nome + palavra de relacionamento" (ex: "Carlos Esposo")
      const relationshipWords = ['esposo', 'esposa', 'marido', 'mulher', 'namorado', 'namorada', 'noivo', 'noiva', 'companheiro', 'companheira', 'parceiro', 'parceira'];
      const namePattern = /([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*)\s+(esposo|esposa|marido|mulher|namorado|namorada|noivo|noiva|companheiro|companheira|parceiro|parceira)/gi;
      const matches = lyrics.match(namePattern);
      if (matches && matches.length > 0) {
        errors.push(`Detectado padrão incorreto de nome + palavra de relacionamento: ${matches.join(', ')}. Use vírgula ou frase contextualizada.`);
      }
      
      // 2. Verificar palavras de relacionamento isoladas após nomes (sem vírgula ou contexto)
      const isolatedPattern = /([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)\s+(esposo|esposa|marido|mulher)\b/gi;
      const isolatedMatches = lyrics.match(isolatedPattern);
      if (isolatedMatches && isolatedMatches.length > 0) {
        errors.push(`Palavras de relacionamento aparecendo como parte do nome: ${isolatedMatches.join(', ')}`);
      }
      
      // 3. Verificar se há informações muito soltas (nomes seguidos de palavras sem contexto)
      const loosePattern = /([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)\s+([a-záéíóúâêôçãõ]{4,})\s*$/gm;
      const looseMatches = [...lyrics.matchAll(loosePattern)];
      if (looseMatches.length > 2) {
        warnings.push('Possíveis informações soltas detectadas. Verifique se todas as informações estão contextualizadas.');
      }
      
      // 4. Verificar transições abruptas (muitas quebras de linha sem conectores)
      const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
      let abruptTransitions = 0;
      for (let i = 1; i < lines.length; i++) {
        const prevLine = lines[i - 1].toLowerCase();
        const currLine = lines[i].toLowerCase();
        // Se a linha anterior termina com ponto e a atual começa com nome sem contexto, pode ser transição abrupta
        if (prevLine.match(/[.!?]$/) && currLine.match(/^[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+\s+[A-ZÁÉÍÓÚÂÊÔÇ]/)) {
          abruptTransitions++;
        }
      }
      if (abruptTransitions > 2) {
        warnings.push(`Possíveis transições abruptas detectadas (${abruptTransitions}). Verifique o fluxo narrativo.`);
      }
      
      // 5. Verificar palavras proibidas: xonei, xonado e variações
      const bannedWords = ['xonei', 'xonado', 'xone', 'xona'];
      const foundBanned: string[] = [];
      bannedWords.forEach(word => {
        // Buscar variações com diferentes acentuações e maiúsculas/minúsculas
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(lyricsLower)) {
          foundBanned.push(word);
        }
      });
      if (foundBanned.length > 0) {
        errors.push(`Palavras proibidas detectadas: ${foundBanned.join(', ')}. Use alternativas como "me apaixonei", "me encantei", "me emocionei".`);
      }
      
      // 5.1 Verificar uso de terceira pessoa para pessoa homenageada (quando deveria ser segunda pessoa)
      const thirdPersonPatterns = [
        /\bela\s+(é|foi|será|está|estava|seria)\b/gi,
        /\bele\s+(é|foi|será|está|estava|seria)\b/gi,
        /\bdela\s+(eu|me|minha|meu)\b/gi,
        /\bdele\s+(eu|me|minha|meu)\b/gi,
        /\bela\s+me\s+(ensinou|mostrou|deu|trouxe)\b/gi,
        /\bele\s+me\s+(ensinou|mostrou|deu|trouxe)\b/gi
      ];
      const foundThirdPerson: string[] = [];
      thirdPersonPatterns.forEach((pattern, index) => {
        if (pattern.test(lyrics)) {
          const examples = ['ela é', 'ele é', 'dela eu', 'dele eu', 'ela me', 'ele me'];
          foundThirdPerson.push(examples[index] || 'terceira pessoa');
        }
      });
      if (foundThirdPerson.length > 0) {
        errors.push(`Uso de terceira pessoa detectado para pessoa homenageada: ${foundThirdPerson.join(', ')}. Use segunda pessoa (você, te, sua) ao invés de terceira pessoa (ela, ele, dela, dele).`);
      }
      
      // 5.2 Verificar gírias e abreviações (erro recuperável)
      const commonSlangAndAbbr = [
        'vc', 'vcs', 'pq', 'tb', 'tbm', 'blz', 'tá', 'né', 'pra', 'pro', 'pros', 'pras',
        'naum', 'nao', 'mt', 'mtos', 'mtas', 'td', 'tds', 'tdas', 'hj', 'amanha',
        'cmg', 'ctg', 'cm', 'dps', 'vlw', 'obg', 'obgd', 'obgda', 'pf', 'pfv', 'pfvr',
        'tmj', 'flw', 'eh'
      ];
      const foundSlang: string[] = [];
      // lyricsLower já foi declarado no início da função
      commonSlangAndAbbr.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(lyricsLower)) {
          foundSlang.push(term);
        }
      });
      if (foundSlang.length > 0) {
        errors.push(`Gírias/abreviações detectadas na letra: ${foundSlang.join(', ')}. Use palavras completas.`);
      }
      
      // 6. Verificar listas/palavras soltas (erro recuperável)
      // Detectar sequências de palavras isoladas (3+ palavras separadas por vírgulas sem verbos/conectores)
      const isolatedWordsPattern = /([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s*,\s*[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+){2,})(?:\s*$|\s*\n)/g;
      const isolatedMatchesList = [...lyrics.matchAll(isolatedWordsPattern)];
      if (isolatedMatchesList.length > 0) {
        const examples = isolatedMatchesList.slice(0, 3).map(m => m[1]).join(', ');
        errors.push(`Listas/palavras soltas detectadas: ${examples}. Integre todas as palavras em frases completas com contexto.`);
      }
      
      // 7. Verificar homenagem coletiva (REGRA 11)
      const aboutWhoText = quizData?.about_who || '';
      const isCollective = isCollectiveHonor(aboutWhoText);
      
      if (isCollective) {
        // Extrair refrões da letra
        const chorusPattern = /\[Refrão(?:\s*Final)?\s*\](.*?)(?=\[|$)/gis;
        const choruses: string[] = [];
        let match;
        while ((match = chorusPattern.exec(lyrics)) !== null) {
          choruses.push(match[1].trim());
        }
        
        if (choruses.length > 0) {
          const chorusText = choruses.join(' ').toLowerCase();
          
          // Verificar se usa "você" no singular (proibido em homenagem coletiva)
          const singularVocêPattern = /\bvocê\b/g;
          if (singularVocêPattern.test(chorusText)) {
            errors.push('Homenagem coletiva detectada, mas o refrão usa "você" no singular. Use "vocês" ou construção coletiva explícita.');
          }
          
          // Verificar se cita apenas um nome (proibido em homenagem coletiva)
          // Contar nomes próprios no refrão
          const namePatternInChorus = /\b[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)*\b/g;
          const namesInChorus = chorusText.match(namePatternInChorus) || [];
          const uniqueNamesInChorus = new Set(namesInChorus);
          
          // Se há apenas um nome único no refrão, pode ser individualização
          if (uniqueNamesInChorus.size === 1) {
            warnings.push('Homenagem coletiva detectada, mas o refrão cita apenas um nome. Verifique se deve usar construção coletiva ("vocês", "meus filhos", etc.).');
          }
          
          // Verificar se usa construção coletiva explícita (recomendado)
          const collectiveMarkers = [
            'vocês', 'meus filhos', 'minhas filhas', 'nós', 'esse amor que construímos',
            'cada um de vocês', 'todos vocês', 'todas vocês', 'meus amores', 'minhas vidas'
          ];
          const hasCollectiveMarker = collectiveMarkers.some(marker => chorusText.includes(marker));
          
          if (!hasCollectiveMarker && !singularVocêPattern.test(chorusText)) {
            warnings.push('Homenagem coletiva detectada. Considere usar construção coletiva explícita no refrão ("vocês", "meus filhos", "nós", etc.).');
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    };

    const callOpenAI = async (customPrompt?: string, customTemperature?: number, retryCount?: number): Promise<Response> => {
      const finalPrompt = customPrompt || userPrompt;
      const finalTemperature = customTemperature !== undefined ? customTemperature : 0.7;
      const attempt = (retryCount || 0) + 1;
      
      console.log(`🔄 Tentativa ${attempt} de geração (temperature: ${finalTemperature})`);
      
      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAIModel,
          max_completion_tokens: 2000,
          temperature: finalTemperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalPrompt }
          ],
          response_format: { type: 'json_object' }
        }),
      });
    };

    // Função para processar resposta e validar
    const processAndValidateResponse = async (response: Response, attempt: number): Promise<{ lyricsJson: any; validation: ValidationResult } | null> => {
      if (!response.ok) {
        console.error(`❌ Response não OK: ${response.status} ${response.statusText}`);
        return null;
      }

      // Ler o texto primeiro (response só pode ser lido uma vez)
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('❌ Erro ao ler texto da resposta:', textError);
        return null;
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON da resposta:', jsonError);
        console.error('❌ Resposta em texto:', responseText.substring(0, 500));
        return null;
      }
      
      let generatedText = data?.choices?.[0]?.message?.content;
      
      if (!generatedText || typeof generatedText !== 'string') {
        console.error('❌ generatedText inválido:', { 
          hasData: !!data, 
          hasChoices: !!data?.choices,
          choicesLength: data?.choices?.length,
          hasMessage: !!data?.choices?.[0]?.message,
          hasContent: !!data?.choices?.[0]?.message?.content,
          contentType: typeof data?.choices?.[0]?.message?.content
        });
        return null;
      }

      // Parse JSON
      try {
        let cleanText = generatedText.trim();
        cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
        }
        
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        }
        
        const lyricsJson = JSON.parse(cleanText);
        
        // Validação mais robusta
        if (!lyricsJson || typeof lyricsJson !== 'object') {
          console.error('❌ lyricsJson não é um objeto:', typeof lyricsJson, lyricsJson);
          return null;
        }
        
        if (!lyricsJson.title || typeof lyricsJson.title !== 'string' || lyricsJson.title.trim().length === 0) {
          console.error('❌ lyricsJson.title inválido:', lyricsJson.title);
          return null;
        }
        
        if (!lyricsJson.lyrics || typeof lyricsJson.lyrics !== 'string' || lyricsJson.lyrics.trim().length === 0) {
          console.error('❌ lyricsJson.lyrics inválido:', typeof lyricsJson.lyrics, lyricsJson.lyrics?.substring(0, 100));
          return null;
        }

        // Validar coerência
        const validation = validateLyricsCoherence(lyricsJson.lyrics, quiz || {});
        
        console.log(`✅ Validação tentativa ${attempt}:`, {
          isValid: validation.isValid,
          errors: validation.errors.length,
          warnings: validation.warnings.length
        });
        
        if (validation.errors.length > 0) {
          console.warn('⚠️ Erros de validação:', validation.errors);
        }
        if (validation.warnings.length > 0) {
          console.warn('⚠️ Avisos de validação:', validation.warnings);
        }
        
        return { lyricsJson, validation };
      } catch (e) {
        console.error('❌ Erro ao processar resposta:', e);
        return null;
      }
    };

    // Tentar gerar com validação e regeneração automática
    let lyricsJson: any = null;
    let validation: ValidationResult | null = null;
    let bestAttempt = 0;
    let bestLyricsJson: any = null;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let currentPrompt = userPrompt;
      let currentTemperature = 0.7; // Sempre 0.7, mantendo criatividade
      
      // Se não é a primeira tentativa, ajustar apenas o prompt (temperatura permanece 0.7)
      if (attempt > 0 && validation && !validation.isValid) {
        // Manter temperatura em 0.7 - não reduzir
        const errorList = validation.errors.join('; ');
        currentPrompt = `${userPrompt}

⚠️ ATENÇÃO ESPECIAL - REGENERAÇÃO NECESSÁRIA:
A versão anterior tinha os seguintes problemas de coerência:
${errorList}

CORREÇÕES OBRIGATÓRIAS:
- Garanta que todas as informações estejam contextualizadas
- NUNCA use palavras de relacionamento como parte do nome
- Sempre separe nomes de palavras de relacionamento com vírgula ou em frases completas
- Evite especialmente: ${errorList}`;
        
        console.log(`🔄 Regenerando devido a problemas de validação (tentativa ${attempt + 1}/${maxAttempts}) - temperatura: ${currentTemperature}`);
      }

      let response = await callOpenAI(currentPrompt, currentTemperature, attempt);
      
      // Tratar erros de rede/API
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        console.warn('⚠️ OpenAI retornou', response.status, '- retry em 800ms');
        await new Promise((r) => setTimeout(r, 800));
        response = await callOpenAI(currentPrompt, currentTemperature, attempt);
      }

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (textError) {
          console.error('❌ Erro ao ler texto do erro:', textError);
          errorText = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('❌ OpenAI Error Response:', errorText);
        
        if (response.status === 401) {
          throw new Error('API Key inválida. Verifique OPENAI_API_KEY nas configurações do Supabase.');
        } else if (response.status === 404) {
          throw new Error(`Modelo OpenAI não disponível: "${openAIModel}". Verifique se sua conta/organização tem acesso e se o nome do modelo está correto.`);
        } else if (response.status === 429) {
          throw new Error('Rate limit excedido. Tente novamente em alguns minutos.');
        } else if (response.status === 400) {
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(`Requisição inválida: ${errorJson.error?.message || errorText}`);
          } catch {
            throw new Error(`Requisição inválida: ${errorText}`);
          }
        } else if (response.status >= 500) {
          throw new Error(`Erro interno do servidor OpenAI (${response.status}). Tente novamente.`);
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await processAndValidateResponse(response, attempt + 1);
      
      if (result) {
        lyricsJson = result.lyricsJson;
        validation = result.validation;
        
        // Se passou na validação, usar esta versão
        if (validation.isValid) {
          console.log('✅ Letra gerada passou na validação de coerência!');
          bestAttempt = attempt + 1;
          bestLyricsJson = lyricsJson;
          break;
        } else {
          // Guardar a melhor versão até agora
          if (attempt === 0 || !bestLyricsJson) {
            bestLyricsJson = lyricsJson;
            bestAttempt = attempt + 1;
          }
        }
      } else {
        console.warn(`⚠️ Tentativa ${attempt + 1} falhou ao processar resposta`);
      }
      
      // Aguardar um pouco antes da próxima tentativa
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Se não passou na validação após todas as tentativas, usar a melhor versão com aviso
    if (!validation || !validation.isValid) {
      console.warn('⚠️ Letra gerada não passou completamente na validação, usando melhor versão disponível');
      if (bestLyricsJson) {
        lyricsJson = bestLyricsJson;
      } else {
        throw new Error('Não foi possível gerar uma letra válida após múltiplas tentativas');
      }
    }

    // Continuar com o processamento normal usando lyricsJson
    console.log('📦 OpenAI Response processada:', {
      attempt: bestAttempt,
      has_lyrics: !!lyricsJson,
      validation_passed: validation?.isValid || false
    });

    // Validar que lyricsJson existe e tem as propriedades necessárias
    if (!lyricsJson) {
      throw new Error('Resposta da OpenAI inválida: lyricsJson é null ou undefined');
    }
    
    if (!lyricsJson.lyrics || typeof lyricsJson.lyrics !== 'string') {
      console.error('❌ lyricsJson inválido:', JSON.stringify(lyricsJson, null, 2));
      throw new Error('Resposta da OpenAI inválida: lyrics não encontrado ou formato incorreto');
    }
    
    if (!lyricsJson.title || typeof lyricsJson.title !== 'string') {
      console.error('❌ lyricsJson inválido (sem title):', JSON.stringify(lyricsJson, null, 2));
      throw new Error('Resposta da OpenAI inválida: title não encontrado ou formato incorreto');
    }

    // Log do conteúdo da letra antes do parsing
    console.log('📝 Conteúdo da letra recebido (primeiros 1000 caracteres):', lyricsJson.lyrics.substring(0, 1000));
    console.log('📝 Tamanho total da letra:', lyricsJson.lyrics.length, 'caracteres');
    
    // Converter formato de lyrics string para verses array
    let verses: Array<{ type: string; text: string }> = [];
    try {
      verses = parseLyricsString(lyricsJson.lyrics);
      console.log('✅ Parse concluído. Número de seções encontradas:', verses.length);
      if (verses.length > 0) {
        console.log('✅ Primeiras seções:', verses.slice(0, 3).map(v => ({ type: v.type, textPreview: v.text.substring(0, 50) })));
      }
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da letra:', parseError);
      const lyricsPreview = lyricsJson?.lyrics ? (lyricsJson.lyrics.substring(0, 1000) || '') : 'N/A';
      console.error('❌ Conteúdo completo da letra (primeiros 1000 caracteres):', lyricsPreview);
      throw new Error(`Erro ao fazer parse da letra: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    if (verses.length === 0) {
      const lyricsPreview = lyricsJson?.lyrics ? (lyricsJson.lyrics.substring(0, 1000) || '') : 'N/A';
      console.error('❌ Nenhuma seção encontrada na letra após parsing');
      console.error('❌ Conteúdo completo da letra (primeiros 1000 caracteres):', lyricsPreview);
      console.error('❌ Padrões procurados: [Verso], [Refrão], [Pré-Refrão], [Ponte], [Refrão Final]');
      
      // Tentar criar uma seção única como fallback
      if (lyricsJson.lyrics && lyricsJson.lyrics.trim().length > 0) {
        console.warn('⚠️ Tentando criar seção única como fallback...');
        verses = [{
          type: 'verse',
          text: lyricsJson.lyrics.trim()
        }];
        console.log('✅ Fallback criado: 1 seção única');
      } else {
        throw new Error('Nenhuma seção de letra encontrada após parsing e letra está vazia');
      }
    }
    
    // Criar objeto lyrics no formato esperado
    lyricsJson = {
      title: lyricsJson.title,
      verses: verses,
      style: quiz?.style || styleTxt,
      language: language,
      tone: emotionalTone
    };
    
    console.log('✅ Letra convertida para formato verses:', {
      title: lyricsJson.title,
      verses_count: lyricsJson.verses.length
    });
    
    // ✅ VERIFICAÇÃO: Log para verificar se acentos estão sendo preservados
    try {
      const versesText = (lyricsJson?.verses || []).map((v: any) => v?.text || '').filter(Boolean).join(' ');
      const hasAccents = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(versesText);
      console.log('🔤 Verificação de acentos:', {
        has_accents: hasAccents,
        sample: lyricsJson?.verses?.[0]?.text?.substring(0, 100) || ''
      });
    } catch (accentError) {
      console.warn('⚠️ Erro ao verificar acentos (não crítico):', accentError);
    }

    // Enriquecer letra com dados do quiz (manter formato original para salvar no job)
    const versesForSave = lyricsJson?.verses || [];
    if (versesForSave.length === 0) {
      throw new Error('Nenhuma seção de letra disponível para salvar');
    }
    
    const lyricsToSave = {
      title: lyricsJson?.title || 'Música sem título',
      lyrics: versesForSave.map((v: any) => `[${v.type}]\n${v.text}`).join('\n\n'),
      style: quiz?.style || styleTxt,
      language: language
    };

    let approvalData: any = null;
    let existingApproval: any = null;
    if (!isPreview) {
      // Salvar no job
      console.log('💾 Salvando letra no job...');
      const { data: updateData, error: updateError } = await supabaseClient
        .from('jobs')
        .update({
          gpt_lyrics: lyricsToSave,
          status: 'completed', // ✅ CORREÇÃO: Mudar status para 'completed' quando a letra for gerada
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id)
        .select();

      if (updateError) {
        console.error('❌ Erro ao salvar no job:', updateError);
        throw new Error(`Erro ao salvar letra: ${updateError.message}`);
      }

      console.log('✅ Letra salva no job:', updateData);

      // Atualizar ou criar a aprovação de letra
      const { data: fetchedApproval, error: fetchApprovalError } = await supabaseClient
        .from('lyrics_approvals')
        .select('id, regeneration_count, lyrics, order_id, quiz_id, voice')
        .eq('job_id', job_id)
        .maybeSingle(); // ✅ CORREÇÃO: usar maybeSingle() em vez de single()

      existingApproval = fetchedApproval;
      const versesForPreview = (lyricsJson?.verses && Array.isArray(lyricsJson.verses)) ? lyricsJson.verses : [];
      const newLyricsPreview = versesForPreview.length > 0 
        ? versesForPreview
            .filter((v: any) => v && typeof v === 'object' && v.type && v.text)
            .map((v: any) => `[${v.type}]\n${v.text}`)
            .join('\n\n')
            .substring(0, 200) + '...'
        : 'Nova letra gerada';

      if (fetchApprovalError) {
        console.warn('⚠️ Erro ao buscar aprovação existente (não crítico):', fetchApprovalError);
      }

      if (existingApproval) {
        // Aprovação existe, verificar se ainda existe antes de atualizar
        const newRegenerationCount = (existingApproval.regeneration_count || 0) + 1;
        console.log('🔄 Atualizando aprovação existente - regeneração #' + newRegenerationCount);
        console.log('📊 Contador anterior:', existingApproval.regeneration_count || 0);
        console.log('📊 Novo contador:', newRegenerationCount);

        // ✅ CORREÇÃO: Verificar se aprovação ainda existe antes de tentar atualizar
        const { data: approvalStillExists, error: checkError } = await supabaseClient
          .from('lyrics_approvals')
          .select('id')
          .eq('id', existingApproval.id)
          .maybeSingle();

        if (checkError) {
          console.warn('⚠️ Erro ao verificar se aprovação ainda existe (não crítico):', checkError);
        }

        if (!approvalStillExists) {
          console.warn('⚠️ Aprovação foi deletada entre a busca e o UPDATE. Pulando atualização.');
        } else {
          // ✅ CORREÇÃO: Usar maybeSingle() e tratar erro PGRST116 especificamente
          try {
            const { data: updatedApproval, error: approvalError } = await supabaseClient
              .from('lyrics_approvals')
              .update({
                lyrics: lyricsToSave,
                lyrics_preview: newLyricsPreview,
                regeneration_count: newRegenerationCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingApproval.id)
              .select('*')
              .maybeSingle(); // ✅ CORREÇÃO: usar maybeSingle() para evitar erro se não retornar linhas

            if (approvalError) {
              // ✅ CORREÇÃO: Tratar erro PGRST116 especificamente (0 rows)
              if (approvalError.code === 'PGRST116' || approvalError.message?.includes('0 rows')) {
                console.warn('⚠️ UPDATE não retornou linhas (PGRST116) - aprovação pode ter sido deletada durante o UPDATE');
              } else {
                console.warn('⚠️ Erro ao atualizar aprovação (não crítico):', approvalError);
              }
            } else if (updatedApproval) {
              console.log('✅ Aprovação atualizada:', updatedApproval);
              approvalData = updatedApproval;
            } else {
              console.warn('⚠️ UPDATE não retornou nenhuma linha (aprovação pode ter sido deletada)');
            }
          } catch (updateException) {
            // ✅ CORREÇÃO: Capturar exceções durante o UPDATE
            console.warn('⚠️ Exceção ao atualizar aprovação (não crítico):', updateException);
          }
        }
      } else {
        // Aprovação não existe, buscar job para obter order_id e quiz_id
        console.log('ℹ️ Aprovação não existe ainda, será criada pelo generate-lyrics-for-approval');
        // Não criar aqui, deixar o generate-lyrics-for-approval criar
        // Isso evita duplicação e mantém o fluxo correto
      }
    }

    // Validar que lyricsJson existe antes de retornar
    if (!lyricsJson || !lyricsJson.title || !lyricsJson.verses || !Array.isArray(lyricsJson.verses)) {
      console.error('❌ Dados de letra inválidos para retornar:', {
        hasLyricsJson: !!lyricsJson,
        hasTitle: !!lyricsJson?.title,
        hasVerses: !!lyricsJson?.verses,
        isVersesArray: Array.isArray(lyricsJson?.verses)
      });
      throw new Error('Dados de letra inválidos para retornar');
    }
    
    console.log('✅ Retornando resposta de sucesso');
    return new Response(
      JSON.stringify({
        success: true,
        lyrics: lyricsJson, // Já está no formato {title, verses, style, language, tone}
        job_id: isPreview ? null : job_id,
        approval: approvalData || null, // Incluir dados da aprovação atualizada (pode ser null se não existir ainda)
        regeneration_count: existingApproval ? (existingApproval.regeneration_count || 0) + 1 : 0
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in generate-lyrics-internal:', error);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    // Extrair mensagem de erro de forma mais robusta
    let errorMessage = 'Erro desconhecido ao gerar letra';
    
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.error) {
      errorMessage = typeof error.error === 'string' ? error.error : error.error?.message || JSON.stringify(error.error);
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }
    
    // Não sobrescrever mensagens de erro relacionadas à API Key, pois agora temos fallback
    // A mensagem original do erro é mais útil para diagnóstico
    
    // Tentar atualizar o job com o erro
    try {
      if (job_id && !isPreview) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
        const supabaseClient = createClient(supabaseUrl, serviceKey);
        
        await supabaseClient
          .from('jobs')
          .update({ 
            status: 'failed', 
            error: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', job_id);
        console.log('✅ Job atualizado com status failed:', job_id);
      } else {
        console.warn('⚠️ job_id não disponível ou preview ativo para atualizar status');
      }
    } catch (updateError) {
      console.error('❌ Erro ao atualizar job com erro:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.details || null,
        status: 500
      }),
      {
        headers: corsHeaders,
        status: 500,
      }
    );
  }
});
