import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

// Headers simplificados (sem rate limiting)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
        headers: corsHeaders,
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
        headers: corsHeaders,
      });
    }

    // Verificar se é admin
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin' // Função aceita text, não precisa de cast
    });

    if (roleError) {
      console.error('Erro ao verificar role:', roleError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao verificar permissões',
        success: false
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Sem permissão de admin',
        success: false
      }), {
        status: 200,
        headers: corsHeaders,
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
    
    const aboutWho = expandAbbreviations(quiz_data.about_who || 'uma pessoa especial');
    const relationship = expandAbbreviations(quiz_data.relationship || 'relação especial');
    const occasion = expandAbbreviations(quiz_data.occasion || 'momento especial');
    const qualities = expandAbbreviations(quiz_data.qualities ?? '').trim();
    const keyMoments = expandAbbreviations(quiz_data.key_moments ?? '').trim();
    const memoriesTxt = expandAbbreviations(quiz_data.memories ?? '').trim();
    const messageTxt = expandAbbreviations(quiz_data.message || 'mensagem do coração');

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

    // Detectar gênero analisando TODO o texto do quiz (adjetivos, pronomes, relacionamentos)
    const detectGenderFromText = (text: string): 'woman' | 'man' | 'unknown' => {
      if (!text) return 'unknown';
      const textLower = text.toLowerCase();
      
      let womanScore = 0;
      let manScore = 0;
      
      // Adjetivos femininos (terminados em -a, -ada, -ora, -inha, etc.)
      const womanAdjectives = [
        'trabalhadora', 'bonita', 'linda', 'querida', 'amada', 'especial', 'maravilhosa',
        'incrível', 'perfeita', 'adorável', 'carinhosa', 'doce', 'gentil', 'amorosa',
        'dedicada', 'esforçada', 'inteligente', 'sábia', 'forte', 'corajosa', 'brava',
        'feliz', 'alegre', 'sorridente', 'encantadora', 'fascinante', 'única', 'rara',
        'preciosa', 'valiosa', 'importante', 'essencial', 'necessária', 'presente',
        'companheira', 'amiga', 'leal', 'fiel', 'confiável', 'honesta', 'sincera',
        'humilde', 'generosa', 'solidária', 'compassiva', 'empática', 'sensível',
        'criativa', 'talentosa', 'habilidosa', 'capaz', 'competente', 'eficiente',
        'organizada', 'disciplinada', 'responsável', 'cuidadosa', 'atenciosa',
        'paciente', 'tolerante', 'compreensiva', 'flexível', 'adaptável'
      ];
      
      // Adjetivos masculinos (terminados em -o, -ado, -or, -inho, etc.)
      const manAdjectives = [
        'trabalhador', 'bonito', 'lindo', 'querido', 'amado', 'especial', 'maravilhoso',
        'incrível', 'perfeito', 'adorável', 'carinhoso', 'doce', 'gentil', 'amoroso',
        'dedicado', 'esforçado', 'inteligente', 'sábio', 'forte', 'corajoso', 'bravo',
        'feliz', 'alegre', 'sorridente', 'encantador', 'fascinante', 'único', 'raro',
        'precioso', 'valioso', 'importante', 'essencial', 'necessário', 'presente',
        'companheiro', 'amigo', 'leal', 'fiel', 'confiável', 'honesto', 'sincero',
        'humilde', 'generoso', 'solidário', 'compassivo', 'empático', 'sensível',
        'criativo', 'talentoso', 'habilidoso', 'capaz', 'competente', 'eficiente',
        'organizado', 'disciplinado', 'responsável', 'cuidadoso', 'atencioso',
        'paciente', 'tolerante', 'compreensivo', 'flexível', 'adaptável'
      ];
      
      // Relacionamentos femininos
      const womanRelationships = [
        'esposa', 'mulher', 'namorada', 'noiva', 'companheira', 'parceira',
        'mãe', 'mãezinha', 'mamãe', 'mamã', 'mamae',
        'filha', 'filhinha', 'filhas',
        'irmã', 'irmazinha', 'irmãs',
        'avó', 'avozinha', 'vovó', 'vovozinha',
        'tia', 'tiazinha', 'tias',
        'sobrinha', 'primas', 'cunhada', 'nora', 'sogra', 'sogrinha',
        'amiga', 'amiguinha', 'amigas'
      ];
      
      // Relacionamentos masculinos
      const manRelationships = [
        'esposo', 'marido', 'namorado', 'noivo', 'companheiro', 'parceiro',
        'pai', 'paizinho', 'papai', 'papá',
        'filho', 'filhinho', 'filhos',
        'irmão', 'irmãozinho', 'irmãos',
        'avô', 'avozinho', 'vovô', 'vovozinho',
        'tio', 'tiozinho', 'tios',
        'sobrinho', 'primos', 'cunhado', 'genro', 'sogro', 'sogrinho',
        'amigo', 'amiguinho', 'amigos'
      ];
      
      // Pronomes e artigos femininos
      const womanPronouns = [
        'ela', 'dela', 'nela', 'com ela', 'para ela', 'a ela', 'na dela',
        'minha esposa', 'minha mulher', 'minha namorada', 'minha mãe', 'minha filha',
        'sua esposa', 'sua mulher', 'sua namorada', 'sua mãe', 'sua filha',
        'a esposa', 'a mulher', 'a namorada', 'a mãe', 'a filha'
      ];
      
      // Pronomes e artigos masculinos
      const manPronouns = [
        'ele', 'dele', 'nele', 'com ele', 'para ele', 'a ele', 'no dele',
        'meu esposo', 'meu marido', 'meu namorado', 'meu pai', 'meu filho',
        'seu esposo', 'seu marido', 'seu namorado', 'seu pai', 'seu filho',
        'o esposo', 'o marido', 'o namorado', 'o pai', 'o filho'
      ];
      
      // Contar ocorrências de palavras-chave femininas
      womanAdjectives.forEach(word => {
        const matches = (textLower.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
        womanScore += matches * 2; // Adjetivos têm peso 2
      });
      
      womanRelationships.forEach(word => {
        const matches = (textLower.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
        womanScore += matches * 3; // Relacionamentos têm peso 3
      });
      
      womanPronouns.forEach(phrase => {
        const matches = (textLower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        womanScore += matches * 2; // Pronomes têm peso 2
      });
      
      // Contar ocorrências de palavras-chave masculinas
      manAdjectives.forEach(word => {
        const matches = (textLower.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
        manScore += matches * 2; // Adjetivos têm peso 2
      });
      
      manRelationships.forEach(word => {
        const matches = (textLower.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
        manScore += matches * 3; // Relacionamentos têm peso 3
      });
      
      manPronouns.forEach(phrase => {
        const matches = (textLower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        manScore += matches * 2; // Pronomes têm peso 2
      });
      
      // Detectar padrões de adjetivos por terminação
      const womanEndings = /(?:trabalhadora|bonita|linda|querida|amada|especial|maravilhosa|incrível|perfeita|adorável|carinhosa|doce|gentil|amorosa|dedicada|esforçada|inteligente|sábia|forte|corajosa|brava|feliz|alegre|sorridente|encantadora|fascinante|única|rara|preciosa|valiosa|importante|essencial|necessária|presente|companheira|amiga|leal|fiel|confiável|honesta|sincera|humilde|generosa|solidária|compassiva|empática|sensível|criativa|talentosa|habilidosa|capaz|competente|eficiente|organizada|disciplinada|responsável|cuidadosa|atenciosa|paciente|tolerante|compreensiva|flexível|adaptável)\b/gi;
      const manEndings = /(?:trabalhador|bonito|lindo|querido|amado|especial|maravilhoso|incrível|perfeito|adorável|carinhoso|doce|gentil|amoroso|dedicado|esforçado|inteligente|sábio|forte|corajoso|bravo|feliz|alegre|sorridente|encantador|fascinante|único|raro|precioso|valioso|importante|essencial|necessário|presente|companheiro|amigo|leal|fiel|confiável|honesto|sincero|humilde|generoso|solidário|compassivo|empático|sensível|criativo|talentoso|habilidoso|capaz|competente|eficiente|organizado|disciplinado|responsável|cuidadoso|atencioso|paciente|tolerante|compreensivo|flexível|adaptável)\b/gi;
      
      const womanEndingMatches = (textLower.match(womanEndings) || []).length;
      const manEndingMatches = (textLower.match(manEndings) || []).length;
      
      womanScore += womanEndingMatches;
      manScore += manEndingMatches;
      
      // Determinar gênero baseado na pontuação
      if (womanScore > manScore && womanScore > 0) return 'woman';
      if (manScore > womanScore && manScore > 0) return 'man';
      return 'unknown';
    };
    
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
    
    // Analisar TODO o texto do quiz para detectar gênero
    const allQuizText = `${relationship} ${aboutWho} ${qualities} ${keyMoments} ${memoriesTxt} ${messageTxt}`;
    const detectedGender = detectGenderFromText(allQuizText);
    const authorGender = detectAuthorGender(allQuizText);
    
    const isWomanHomenageada = detectedGender === 'woman';
    const isManHomenageado = detectedGender === 'man';
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
    const hasExplicitAboutWho = typeof quiz_data?.about_who === 'string' && quiz_data.about_who.trim().length > 0;
    const honoredNamesRaw = hasExplicitAboutWho ? extractNames(aboutWho) : [];
    const honoredNames = Array.from(new Set(honoredNamesRaw.map((n) => n.trim()))).filter(Boolean);
    const honoredNamesList =
      hasExplicitAboutWho && honoredNames.length > 0
        ? honoredNames.join(', ')
        : hasExplicitAboutWho
          ? aboutWho
          : '';

    // ✅ Função para detectar gírias e abreviações no texto
    const detectSlangAndAbbreviations = (text: string): string[] => {
      const commonSlang = [
        'tá', 'pra', 'vc', 'você', 'tb', 'pq', 'blz', 'mano', 'cara', 
        'né', 'tipo assim', 'tipo', 'assim', 'q', 'c', 'v', 'n', 'd', 't',
        'xonei', 'xonado', 'xone', 'xona'
      ];
      
      const found: string[] = [];
      const textLower = text.toLowerCase();
      
      for (const term of commonSlang) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        if (regex.test(textLower)) {
          found.push(term);
        }
      }
      
      return [...new Set(found)];
    };

    // ✅ Extrair gírias/abreviações permitidas do quiz do cliente
    const quizText = `${aboutWho} ${qualities} ${memoriesTxt} ${messageTxt} ${keyMoments}`;
    const allowedSlangTerms = detectSlangAndAbbreviations(quizText);
    
    console.log('🔍 Gênero detectado:', detectedGender === 'woman' ? 'MULHER' : detectedGender === 'man' ? 'HOMEM' : 'DESCONHECIDO');
    
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

3.4 REGRA – NOMES DE MEMÓRIAS/MOMENTOS/MENSAGEM:
Os nomes mencionados em memórias, momentos importantes e mensagem especial devem aparecer nos versos, na ordem em que são mencionados no quiz.
Apenas o nome da pessoa homenageada (about_who) aparece no refrão.
→ Se houver muitos nomes, distribua-os entre os versos, sem concentrar vários nomes em um único verso.

8. PROIBIÇÃO DE GÍRIAS E ABREVIAÇÕES:
- PROIBIDO usar gírias, abreviações ou linguagem coloquial informal
- PROIBIDO usar: "vc", "pq", "tb", "tbm", "vcs", "blz", "tá", "né", "pra", "pro", etc.
- SEMPRE use palavras completas: "você", "porque", "também", "está", "não é", "para", etc.
- Use linguagem poética, natural, clara e não coloquial
- Evite coloquialismos, mas mantenha naturalidade e fluidez poética

REGRA DE APELIDOS CARINHOSOS:
Se o quiz mencionar um apelido carinhoso:

Ele NÃO é tratado como gíria proibida

Deve ser usado apenas se explicitamente citado pelo cliente

Deve aparecer contextualizado emocionalmente (carinho, intimidade, afeto)

❌ É PROIBIDO usar apelido como palavra solta ou em listas

Preferência de uso: VERSOS, nunca como elemento jogado no refrão.

9. PROIBIÇÃO DE LISTAS (CRÍTICO):
- É PROIBIDO listar palavras, conceitos, qualidades ou nomes em sequência, em qualquer parte da letra.
- Toda ideia deve estar integrada em frases completas, com verbo, contexto e sentido narrativo.
- ❌ PROIBIDO: "João, Maria, Pedro" ou "amor, carinho, dedicação"
- ✅ PERMITIDO: "João sempre esteve ao meu lado, Maria trouxe alegria, e Pedro ensinou valores"

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
1. FIDELIDADE À HISTÓRIA: Preserve todos os fatos essenciais do quiz. Detalhes secundários podem ser integrados como imagens, cenas ou metáforas. Nunca invente fatos não mencionados.
2. Tamanho máximo: 4800 caracteres.
3. Números e unidades sempre por extenso.
4. Evite rimas forçadas - priorize fluidez e verdade.
5. PROIBIDO usar a palavra “xonei” (qualquer variação ou capitalização).

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
ESTRUTURA OBRIGATÓRIA (CRÍTICO - DEVE SER SEGUIDA EXATAMENTE)
────────────────────────
⚠️ ATENÇÃO: Esta estrutura é OBRIGATÓRIA e deve ser seguida EXATAMENTE nesta ordem.
TODAS as seções devem estar presentes. Não pule nenhuma seção.

1. [Verso 1] – variável (4+ linhas, conforme necessário)
2. [Pré-Refrão] – variável (4-8 linhas)
3. [Refrão] – variável (8+ linhas, memorável e consistente)
4. [Verso 2] – variável (4+ linhas, conforme necessário para contar a história)
5. [Verso 3] – variável (4+ linhas, conforme necessário para completar a história)
6. [Pré-Refrão] – repetir ou criar variação
7. [Refrão] – repetir exato
8. [Ponte] – variável (3-6 linhas)
9. [Refrão Final] – versão suave e emocionante do refrão (pode ser modificado)

❌ PROIBIDO:
- Pular qualquer seção
- Alterar a ordem das seções
- Adicionar seções extras
- Omitir marcadores

✅ OBRIGATÓRIO:
- Usar EXATAMENTE os marcadores acima (com maiúsculas e acentos corretos)
- Seguir a ordem exata: [Verso 1] → [Pré-Refrão] → [Refrão] → [Verso 2] → [Verso 3] → [Pré-Refrão] → [Refrão] → [Ponte] → [Refrão Final]
- Todas as 9 seções devem estar presentes
- FORMATO OBRIGATÓRIO: TODAS as seções devem começar com o marcador entre colchetes [ ].
  Exemplos corretos: [Verso 1], [Verso 2], [Verso 3], [Pré-Refrão], [Refrão], [Ponte], [Refrão Final].
  ❌ PROIBIDO formato alternativo: "Verso 1:", "Refrão Final:", "Ponte:" (sem colchetes)

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
${isWomanHomenageada ? `[Se a pessoa homenageada for MULHER]
A música deve ser escrita na PERSPECTIVA MASCULINA.
→ Um homem cantando DIRETAMENTE PARA uma mulher.
→ Use "eu" (homem) falando DIRETAMENTE com "você" (mulher).
→ ❌ NUNCA use "ela", "dela" - sempre use "você", "sua", "te".
→ Utilize adjetivos, pronomes e concordância no FEMININO.` : 
isManHomenageado ? `[Se a pessoa homenageada for HOMEM]
A música deve ser escrita na PERSPECTIVA FEMININA.
→ Uma mulher cantando DIRETAMENTE PARA um homem.
→ Use "eu" (mulher) falando DIRETAMENTE com "você" (homem).
→ ❌ NUNCA use "ele", "dele" - sempre use "você", "seu", "te".
→ Utilize adjetivos, pronomes e concordância no MASCULINO.` : 
`[Se gênero desconhecido]
Use declaração direta em segunda pessoa ("você").
→ ❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.`}

CONCORDÂNCIA GRAMATICAL:
- Detecte automaticamente o gênero da pessoa homenageada.
- Use pronomes, adjetivos e verbos coerentes com esse gênero.
- Priorize linguagem natural. Evite estruturas artificiais.

CONCORDÂNCIA DE QUEM ESCREVE (AUTOR):
- Gênero detectado do autor: ${isAuthorWoman ? 'MULHER' : isAuthorMan ? 'HOMEM' : 'DESCONHECIDO'}.
- Se o autor for MULHER: use primeira pessoa feminina quando necessário (ex.: "estou grata", "fiquei emocionada", "sou a mãe", "sou a esposa").
- Se o autor for HOMEM: use primeira pessoa masculina quando necessário (ex.: "estou grato", "fiquei emocionado", "sou o pai", "sou o esposo").
- Se gênero do autor for DESCONHECIDO: mantenha linguagem de primeira pessoa neutra, evitando marcadores explícitos de gênero.

REGRA DE PERSPECTIVA DIRETA (OBRIGATÓRIA):
- A música é uma CONVERSA DIRETA do autor com a pessoa homenageada.
- Use primeira pessoa (eu, me, meu) para o autor.
- Use segunda pessoa (você, te, teu, sua) para a pessoa homenageada.
- ❌ PROIBIDO usar terceira pessoa (ela, ele, dela, dele) para se referir à pessoa homenageada.

PROIBIÇÃO ABSOLUTA:
NUNCA use a palavra "amante" na letra, exceto se o cliente mencionar explicitamente esta palavra no formulário. Use alternativas como "amor", "parceiro(a)", "companheiro(a)", "pessoa amada", etc.
NUNCA use a palavra "xonei", "xonado", "xone", "xona" ou qualquer variação (maiúsculas, minúsculas, com ou sem acentos).

────────────────────────
NOMES A INCLUIR
────────────────────────
${namesList}

${hasExplicitAboutWho ? `NOME(S) DA PESSOA HOMENAGEADA (APENAS NO REFRÃO): ${honoredNamesList}` : ''}

${allowedSlangTerms.length > 0 ? `GÍRIAS PERMITIDAS (somente estas): ${allowedSlangTerms.join(', ')}` : ''}

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
FORMATO DE RESPOSTA
────────────────────────
Retorne APENAS JSON válido no formato:

{
  "title": "string",
  "lyrics": "string"
}

Nenhuma explicação fora do JSON.`;

    const isSimplifiedQuiz = !qualities && !keyMoments && !memoriesTxt && !!messageTxt;

    const historySection = isSimplifiedQuiz
      ? `Esta música é sobre ${aboutWho}, que é ${relationship}.
${occasion ? `Ocasião: ${occasion}\n` : ''}

HISTÓRIA E MENSAGEM DO CLIENTE (todo o contexto está abaixo):
${messageTxt}`
      : `Esta música é sobre ${aboutWho}, que é ${relationship}.

CONTEXTO:
- Ocasião: ${occasion}
- Qualidades especiais: ${qualities || '(não informado)'}

MOMENTOS IMPORTANTES:
${keyMoments || '(não informado)'}

MEMÓRIAS COMPARTILHADAS:
${memoriesTxt || '(não informado)'}

MENSAGEM PRINCIPAL:
${messageTxt}`;

    const userPrompt = `Criar música de homenagem com base na história real:

⚠️ IMPORTANTE: Esta música é uma DECLARAÇÃO DIRETA do autor para ${aboutWho}.
Escreva como se você estivesse falando DIRETAMENTE com ${aboutWho}, usando:
- Primeira pessoa (eu, me, meu) para o autor
- Segunda pessoa (você, te, teu, sua) para ${aboutWho}
- ❌ NUNCA use terceira pessoa (ela, ele, dela, dele) para se referir a ${aboutWho}
- ❌ NUNCA use "xonei", "xonado", "xone", "xona" ou qualquer variação

${historySection}

NOMES MENCIONADOS: ${namesList}

${uniqueNames.length > 0 ? `⚠️ CRÍTICO: TODOS os ${uniqueNames.length} nome(s) únicos listados acima DEVEM aparecer na letra da música.` : ''}
${hasExplicitAboutWho ? `⚠️ REGRA CRÍTICA: cite o(s) nome(s) da pessoa homenageada APENAS NO REFRÃO (chorus): ${honoredNamesList}. NUNCA use o nome em versos, pré-refrão ou ponte - use pronomes nessas seções.` : ''}

${custom_instructions ? `\nINSTRUÇÕES ESPECIAIS:\n${custom_instructions}` : ''}`;

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
      
      // Palavras proibidas específicas: xonei, xonado e variações
      const bannedTerms = ['xonei', 'xonado', 'xone', 'xona'];
      const bannedFound: string[] = [];
      bannedTerms.forEach(term => {
        // Buscar variações com diferentes acentuações e maiúsculas/minúsculas
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(lyricsLower)) {
          bannedFound.push(term);
        }
      });
      if (bannedFound.length > 0) {
        errors.push(`Palavras proibidas detectadas: ${bannedFound.join(', ')}. Use alternativas como "me apaixonei", "me encantei", "me emocionei".`);
      }
      
      // Verificar uso de terceira pessoa para pessoa homenageada (quando deveria ser segunda pessoa)
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

      // ✅ Verificar gírias/abreviações não permitidas
      const quizTextForValidation = `${aboutWho} ${qualities} ${memoriesTxt} ${messageTxt} ${keyMoments}`;
      const allowedSlang = detectSlangAndAbbreviations(quizTextForValidation);
      const lyricsSlang = detectSlangAndAbbreviations(lyrics);
      
      // Filtrar gírias que não estão na lista permitida
      const forbiddenSlang = lyricsSlang.filter(slang => {
        const slangLower = slang.toLowerCase();
        return !allowedSlang.some(allowed => allowed.toLowerCase() === slangLower);
      });
      
      if (forbiddenSlang.length > 0) {
        errors.push(`Gírias/abreviações não permitidas detectadas: ${forbiddenSlang.join(', ')}. Use apenas as gírias mencionadas pelo cliente no formulário.`);
      }
      
      // Garantir que todos os nomes únicos apareçam na letra
      const missingNames = uniqueNames.filter((name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return !regex.test(lyrics);
      });
      if (missingNames.length > 0) {
        errors.push(`Nomes ausentes na letra: ${missingNames.join(', ')}`);
      }
      
      // ✅ Regra: nome da pessoa homenageada APENAS no refrão (chorus)
      if (hasExplicitAboutWho) {
        const targets = honoredNames.length > 0 ? honoredNames : [aboutWho];
        
        // Extrair seções da letra
        const extractSections = (lyricsText: string): Array<{ type: string; content: string }> => {
          const sections: Array<{ type: string; content: string }> = [];
          // Regex para capturar seções: [Verso 1], [Pré-Refrão], [Refrão], [Refrão Final], [Ponte]
          const sectionRegex = /\[(Verso \d+|Pré-Refrão|Refrão(?: Final)?|Ponte)\]\s*([^\[]+)/gi;
          let match;
          
          while ((match = sectionRegex.exec(lyricsText)) !== null) {
            sections.push({
              type: match[1].trim(),
              content: match[2].trim()
            });
          }
          
          return sections;
        };
        
        const sections = extractSections(lyrics);
        const countNameOccurrences = (name: string, text: string): number => {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
          return (text.match(regex) || []).length;
        };
        
        // Verificar se o nome aparece em seções não permitidas (versos, pré-refrão, ponte)
        const nonChorusSections = sections.filter(s => 
          !s.type.match(/^Refrão/i)
        );
        
        for (const target of targets) {
          const targetName = target.trim();
          if (!targetName) continue;
          
          // Verificar se nome aparece em seções não permitidas
          for (const section of nonChorusSections) {
            const occurrences = countNameOccurrences(targetName, section.content);
            if (occurrences > 0) {
              errors.push(`Nome "${targetName}" da pessoa homenageada aparece em "${section.type}" (deve aparecer APENAS no refrão). Use pronomes ("você", "te", "teu/tua", "seu/sua") em versos, pré-refrão e ponte.`);
            }
          }
          
          // Verificar se o nome aparece no refrão (deve aparecer pelo menos uma vez)
          const chorusSections = sections.filter(s => 
            s.type.match(/^Refrão/i)
          );
          
          if (chorusSections.length === 0) {
            errors.push(`Nenhuma seção de refrão encontrada na letra. O nome "${targetName}" deve aparecer no refrão.`);
          } else {
            const totalChorusOccurrences = chorusSections.reduce((sum, section) => 
              sum + countNameOccurrences(targetName, section.content), 0
            );
            
            if (totalChorusOccurrences === 0) {
              errors.push(`Nome "${targetName}" da pessoa homenageada não aparece no refrão. O nome deve aparecer APENAS no refrão (chorus).`);
            }
          }
        }
      }
      
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
      
      // 5. Verificar gírias e abreviações (erro recuperável)
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
        return null;
      }

      const data = await response.json();
      let generatedText = data.choices?.[0]?.message?.content;
      
      if (!generatedText || typeof generatedText !== 'string') {
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
        
        if (!lyricsJson.title || !lyricsJson.lyrics || typeof lyricsJson.title !== 'string' || typeof lyricsJson.lyrics !== 'string') {
          return null;
        }

        // Validar coerência
        const validation = validateLyricsCoherence(lyricsJson.lyrics, quiz_data);
        
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
        const errorText = await response.text();
        console.error('❌ OpenAI Error Response:', errorText);
        
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
    
    // ✅ VERIFICAÇÃO: Log para verificar se acentos estão sendo preservados
    const hasAccents = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(lyricsJson.lyrics);
    console.log('🔤 Verificação de acentos:', {
      has_accents: hasAccents,
      sample: lyricsJson.lyrics.substring(0, 100)
    });
    
    console.log('✅ Letra validada e convertida com sucesso:', {
      title: lyrics.title,
      verses_count: lyrics.verses.length,
      style: lyrics.style,
      language: lyrics.language,
      tone: lyrics.tone,
      has_accents: hasAccents
    });

    // Log da geração
    await supabase.from('admin_logs').insert({
      admin_user_id: user.id,
      action: 'generate_lyrics',
      target_table: 'admin_generation',
      changes: { quiz_data, custom_instructions, lyrics }
    });

    return new Response(JSON.stringify({ lyrics }), {
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('Erro em admin-generate-lyrics:', error);
    // Retornar sempre 200 para que o frontend possa tratar o erro corretamente
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro desconhecido ao gerar letra',
      success: false
    }), {
      status: 200,
      headers: corsHeaders,
    });
  }
});
