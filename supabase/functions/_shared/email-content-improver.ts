/**
 * Email Content Improver
 * 
 * Funções para melhorar o conteúdo dos emails para melhor deliverability:
 * - Remove emojis de assuntos
 * - Garante alt text em imagens
 * - Adiciona endereço físico (CAN-SPAM compliance)
 * - Melhora estrutura HTML
 */

/**
 * Remove emojis de um assunto de email
 * Emojis em assuntos podem ser marcados como spam
 * 
 * @param subject - Assunto do email
 * @returns Assunto sem emojis
 */
export function removeEmojisFromSubject(subject: string): string {
  // Lista de emojis comuns que podem causar problemas
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
  
  let cleaned = subject.replace(emojiPattern, '');
  
  // Limpar espaços duplos
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Garante que todas as imagens tenham alt text
 * 
 * @param html - HTML do email
 * @param defaultAlt - Texto alternativo padrão se não houver
 * @returns HTML com alt text em todas as imagens
 */
export function ensureImageAltText(html: string, defaultAlt: string = 'Music Lovely'): string {
  // Regex para encontrar imagens sem alt text
  const imgWithoutAlt = /<img([^>]*?)(?<!alt="[^"]*")>/gi;
  
  return html.replace(imgWithoutAlt, (match, attributes) => {
    // Se já tem alt, retornar como está
    if (attributes.includes('alt=')) {
      return match;
    }
    // Adicionar alt text
    return `<img${attributes} alt="${defaultAlt}">`;
  });
}

/**
 * Adiciona endereço físico ao rodapé do email (CAN-SPAM compliance)
 * 
 * @param html - HTML do email
 * @param address - Endereço físico (opcional, usa padrão se não fornecido)
 * @returns HTML com endereço físico no rodapé
 */
export function addPhysicalAddressToFooter(
  html: string, 
  address: {
    company?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    unsubscribeUrl?: string;
  } = {}
): string {
  const defaultAddress = {
    company: 'Music Lovely',
    street: '',
    city: 'São Paulo',
    state: 'SP',
    country: 'Brasil',
    unsubscribeUrl: 'https://musiclovely.com/unsubscribe',
    ...address
  };
  
  // Criar footer com endereço físico
  const footerHtml = `
    <div class="footer" style="text-align: center; font-size: 13px; color: #6B6157; padding: 22px 24px; border-top: 1px solid #E6DED6; margin-top: 30px;">
      <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} ${defaultAddress.company} — <a href="https://musiclovely.com" style="color:#C7855E; text-decoration: none;">musiclovely.com</a></p>
      <p style="margin: 0 0 8px;">Este é um email automático. Para suporte, responda este email.</p>
      <p style="margin: 8px 0 0; font-size: 11px; color: #9B9389;">
        ${defaultAddress.company}${defaultAddress.street ? `<br/>${defaultAddress.street}` : ''}<br/>
        ${defaultAddress.city}${defaultAddress.state ? `, ${defaultAddress.state}` : ''} - ${defaultAddress.country}<br/>
        <a href="${defaultAddress.unsubscribeUrl}" style="color:#C7855E; text-decoration: underline;">Cancelar inscrição</a>
      </p>
    </div>
  `;
  
  // Se já tem footer, substituir; se não, adicionar antes do </body>
  if (html.includes('</body>')) {
    // Remover footer existente se houver
    const footerPattern = /<div class="footer"[^>]*>[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*<\/body>|<\/body>)/gi;
    let updatedHtml = html.replace(footerPattern, '');
    
    // Adicionar novo footer antes do </body>
    updatedHtml = updatedHtml.replace('</body>', `${footerHtml}\n  </body>`);
    return updatedHtml;
  }
  
  // Se não tem </body>, adicionar antes do </html> ou no final
  if (html.includes('</html>')) {
    return html.replace('</html>', `${footerHtml}\n</html>`);
  }
  
  // Se não tem nem </body> nem </html>, adicionar no final
  return html + footerHtml;
}

/**
 * Melhora a estrutura HTML do email para compatibilidade com Outlook
 * - Adiciona meta tags se não existirem
 * - Garante charset UTF-8
 * - Adiciona viewport meta tag
 * - Adiciona comentários condicionais do Outlook (MSO)
 * - Garante estrutura compatível com Word Engine do Outlook
 * 
 * @param html - HTML do email
 * @returns HTML melhorado
 */
export function improveHtmlStructure(html: string): string {
  let improved = html;
  
  // Adicionar meta tags no <head> se não existirem
  if (improved.includes('<head>')) {
    const hasContentType = improved.includes('Content-Type') || improved.includes('charset');
    const hasViewport = improved.includes('viewport');
    const hasFormatDetection = improved.includes('format-detection');
    
    if (!hasContentType || !hasViewport || !hasFormatDetection) {
      const metaTags = `
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no">`;
      
      improved = improved.replace('<head>', `<head>${metaTags}`);
    }
  }
  
  // ✅ Adicionar comentários condicionais do Outlook (MSO) para melhor renderização
  // Outlook usa Word Engine e precisa de estilos inline e estrutura específica
  if (!improved.includes('<!--[if mso]>')) {
    // Adicionar wrapper MSO no início do body se não existir
    if (improved.includes('<body')) {
      const msoWrapper = `
<!--[if mso]>
<style type="text/css">
  body, table, td {font-family: Arial, sans-serif !important;}
  table {border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;}
</style>
<![endif]-->`;
      improved = improved.replace(/<body[^>]*>/i, `$&${msoWrapper}`);
    }
  }
  
  // ✅ Garantir que larguras sejam especificadas em pixels (Outlook prefere)
  // Converter larguras percentuais em tabelas principais para pixels quando possível
  // Isso será feito de forma conservadora para não quebrar layouts existentes
  
  return improved;
}

/**
 * Valida conteúdo do email para detectar possíveis triggers de spam
 * 
 * @param subject - Assunto do email
 * @param html - HTML do email
 * @returns Objeto com avisos e sugestões
 */
export function validateEmailContentForSpam(subject: string, html: string): {
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Verificar palavras em maiúsculas excessivas no assunto
  const uppercaseRatio = (subject.match(/[A-Z]/g) || []).length / Math.max(subject.length, 1);
  if (uppercaseRatio > 0.5 && subject.length > 10) {
    warnings.push('Assunto contém muitas letras maiúsculas (pode ser marcado como spam)');
    suggestions.push('Use maiúsculas apenas no início de palavras importantes');
  }
  
  // Verificar múltiplos pontos de exclamação
  if ((subject.match(/!/g) || []).length > 2) {
    warnings.push('Assunto contém múltiplos pontos de exclamação');
    suggestions.push('Limite a um ponto de exclamação por assunto');
  }
  
  // Verificar palavras comuns de spam no assunto
  const spamWords = ['GRÁTIS', 'GRATIS', 'Ganhe', 'Ganhe', 'URGENTE', 'URGENT', 'CLIQUE AQUI', 'CLICK HERE'];
  const subjectUpper = subject.toUpperCase();
  if (spamWords.some(word => subjectUpper.includes(word))) {
    warnings.push('Assunto contém palavras comuns de spam');
    suggestions.push('Evite palavras como "GRÁTIS", "URGENTE", "CLIQUE AQUI"');
  }
  
  // Verificar proporção texto/imagem
  const textContent = html.replace(/<[^>]+>/g, '').trim();
  const imageCount = (html.match(/<img/gi) || []).length;
  if (imageCount > 0 && textContent.length < 100) {
    warnings.push('Email contém muitas imagens e pouco texto');
    suggestions.push('Adicione mais texto descritivo ao email');
  }
  
  // Verificar links suspeitos
  const linkPattern = /href=["'](https?:\/\/[^"']+)["']/gi;
  const links: string[] = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  
  const suspiciousDomains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl'];
  const hasSuspiciousLinks = links.some(link => 
    suspiciousDomains.some(domain => link.includes(domain))
  );
  
  if (hasSuspiciousLinks) {
    warnings.push('Email contém links de encurtadores (podem ser marcados como spam)');
    suggestions.push('Use links diretos quando possível');
  }
  
  // Verificar se há muito HTML vs texto
  const htmlLength = html.length;
  const textLength = textContent.length;
  const htmlRatio = htmlLength / Math.max(textLength, 1);
  if (htmlRatio > 10) {
    warnings.push('Proporção HTML/texto muito alta (pode indicar email muito estilizado)');
    suggestions.push('Garanta que há conteúdo de texto suficiente');
  }
  
  return { warnings, suggestions };
}

/**
 * Processa e melhora o conteúdo completo de um email
 * Aplica todas as melhorias de deliverability
 * 
 * @param options - Opções de processamento
 * @returns Objeto com assunto e HTML melhorados
 */
export function improveEmailContent(options: {
  subject: string;
  html: string;
  addPhysicalAddress?: boolean;
  physicalAddress?: {
    company?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    unsubscribeUrl?: string;
  };
}): {
  subject: string;
  html: string;
} {
  let { subject, html } = options;
  
  // 1. Remover emojis do assunto
  subject = removeEmojisFromSubject(subject);
  
  // 2. Validar conteúdo para possíveis triggers de spam
  const validation = validateEmailContentForSpam(subject, html);
  if (validation.warnings.length > 0) {
    console.warn('⚠️ [EmailContent] Avisos de validação anti-spam:', validation.warnings);
    if (validation.suggestions.length > 0) {
      console.info('💡 [EmailContent] Sugestões:', validation.suggestions);
    }
  }
  
  // 3. Garantir alt text em imagens
  html = ensureImageAltText(html);
  
  // 4. Melhorar estrutura HTML
  html = improveHtmlStructure(html);
  
  // 5. Adicionar endereço físico (se solicitado)
  if (options.addPhysicalAddress !== false) {
    html = addPhysicalAddressToFooter(html, options.physicalAddress);
  }
  
  return { subject, html };
}

