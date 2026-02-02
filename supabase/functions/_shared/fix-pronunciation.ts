/**
 * Função para corrigir pronúncia de nomes que começam com "Ge" ou "Gi"
 * A IA do Suno tende a pronunciar como "Gue" ou "Gui", mas em português/espanhol
 * deve ser pronunciado com som de "J" (Jê ou Jí)
 */

/**
 * Adiciona guia fonético para nomes que começam com Ge ou Gi
 * @param text - Texto da letra
 * @returns Texto com guias fonéticos adicionados
 */
export function fixGeGiPronunciation(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Regex para encontrar palavras que começam com Ge ou Gi
  // Considera contexto: após pontuação, início de linha, após tags como [Verse], ou início de palavra
  // Captura: Ge seguido de qualquer letra (incluindo acentos) ou Gi seguido de qualquer letra
  const geGiPattern = /\b(Ge[a-záàâãéêíóôõúüç][a-záàâãéêíóôõúüç]*|Gi[a-záàâãéêíóôõúüç][a-záàâãéêíóôõúüç]*)\b/gi;
  
  // Set para rastrear nomes já processados (evitar duplicar guias)
  const processedNames = new Set<string>();
  
  // Função para gerar guia fonético
  const getPhoneticGuide = (name: string): string => {
    const lowerName = name.toLowerCase();
    
    // Gerar pronúncia aproximada
    // Ge -> Jê, Gi -> Jí
    let phonetic = '';
    if (lowerName.startsWith('ge')) {
      const rest = name.substring(2);
      phonetic = `Jê${rest}`;
    } else if (lowerName.startsWith('gi')) {
      const rest = name.substring(2);
      phonetic = `Jí${rest}`;
    } else {
      return name; // Não deveria acontecer, mas por segurança
    }
    
    return `${name} [pronunciado: ${phonetic}]`;
  };
  
  // Substituir apenas a primeira ocorrência de cada nome único
  return text.replace(geGiPattern, (match) => {
    const normalizedName = match.toLowerCase();
    
    // Se já processamos este nome, retornar sem alteração
    if (processedNames.has(normalizedName)) {
      return match;
    }
    
    // Marcar como processado
    processedNames.add(normalizedName);
    
    // Adicionar guia fonético
    return getPhoneticGuide(match);
  });
}

