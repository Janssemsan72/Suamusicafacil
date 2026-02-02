/**
 * Content Security Policy (CSP) Configuration
 * 
 * Centralized CSP configuration following "zen CSP" methodology:
 * - Single source of truth for all CSP directives
 * - Support for Report-Only mode
 * - SHA-256 hashes for inline scripts
 * - Clear separation between dev and production
 * 
 * Usage:
 * - Import `asHeaderValue()` for production CSP
 * - Import `asReportOnlyHeaderValue()` for Report-Only CSP
 * - Use in vite.config.ts, vercel.json, and other deployment configs
 */

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'script-src-elem': string[];
  'script-src-attr'?: string[];
  'style-src': string[];
  'style-src-elem': string[];
  'img-src': string[];
  'media-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-src': string[];
  'worker-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'upgrade-insecure-requests'?: string[];
  'report-uri'?: string[];
  'report-to'?: string[];
}

/**
 * SHA-256 hashes for inline scripts
 * 
 * To calculate a hash:
 * 1. Extract the exact content of the <script> tag (without the tags themselves)
 * 2. Calculate SHA-256 hash
 * 3. Encode in base64
 * 4. Format as 'sha256-<base64>'
 * 
 * Example using Node.js:
 * ```js
 * const crypto = require('crypto');
 * const scriptContent = '...'; // script content without <script> tags
 * const hash = crypto.createHash('sha256').update(scriptContent, 'utf8').digest('base64');
 * console.log(`'sha256-${hash}'`);
 * ```
 */
const INLINE_SCRIPT_HASHES = {
  // Hash for error handling script (index.html - intercepts errors and iframes)
  errorHandling: 'sha256-R5pm0Z5WpLAwPTjSALaWMfLgSEVQ67qXWz89/jL2bIA=',
  
  // Hash for React flag script (index.html - sets window.__REACT_READY__)
  // IMPORTANTE: Este hash foi recalculado - o anterior estava incorreto e causava avisos
  // O hash deve corresponder EXATAMENTE ao conteúdo do script (incluindo espaços e quebras de linha)
  reactFlag: 'sha256-hoe2tEKU1arxeXgU/C4ppV6E1/DucV/QeHjX6PY9jhU=',
  
  // Hash for CSP dynamic script (index.html - CSP violation monitoring in dev)
  cspDynamic: 'sha256-vYjEjUUJiSiUkp4h/8lE6fqzC9dRSxk6yb2hCWS/do0=',
  
  // NOTA: Hashes adicionais foram removidos pois estavam sendo reportados como inválidos
  // Em desenvolvimento, scripts dinâmicos do Vite são permitidos via 'unsafe-inline' em devAdditions
  // Em produção, apenas os 3 hashes acima são necessários para os scripts estáticos do index.html
};

/**
 * Base CSP directives (production-ready, minimal)
 */
const baseDirectives: CSPDirectives = {
  'default-src': ["'self'"],
  
  // Scripts: self + external CDNs
  // NOTA: Hashes SHA-256 devem ser usados apenas em 'script-src-elem' para elementos <script>
  // 'script-src' controla eval(), new Function(), etc., não elementos <script>
  'script-src': [
    "'self'",
    'https://connect.facebook.net',
    'https://*.facebook.net',
    'https://t.contentsquare.net',
    'https://*.contentsquare.net',
    'https://*.similarweb.com',
    'https://cdn.similarweb.com',
    // Hashes removidos - devem estar apenas em script-src-elem
  ],
  
  // Script elements (same as script-src)
  'script-src-elem': [
    "'self'",
    'https://connect.facebook.net',
    'https://*.facebook.net',
    'https://t.contentsquare.net',
    'https://*.contentsquare.net',
    'https://*.similarweb.com',
    'https://cdn.similarweb.com',
    ...Object.values(INLINE_SCRIPT_HASHES).filter(Boolean),
  ],
  
  // Script attributes (inline event handlers like onclick, onerror, etc.)
  // Em produção, usar 'unsafe-hashes' com hashes específicos
  // Em desenvolvimento, permitir 'unsafe-inline' para facilitar debug
  'script-src-attr': [
    "'self'",
    // Hashes para event handlers inline gerados dinamicamente
    "'sha256-4TpZ3Tx5SLybDXPQaSHGuP1RU4D+pzck+02JLVY61BY='",
    "'sha256-5o6pEK3LvCTq+T5Hmtrd52WX2S+TpCCTdAXXa1042Y0='",
  ],
  
  // Styles: self + Google Translate (no unsafe-inline in production)
  'style-src': [
    "'self'",
    'https://www.gstatic.com',
    'https://*.gstatic.com',
    // Note: 'unsafe-inline' removed for production
    // If CSS-in-JS requires it, consider using nonce or hash
  ],
  
  // Style elements (same as style-src)
  'style-src-elem': [
    "'self'",
    'https://www.gstatic.com',
    'https://*.gstatic.com',
  ],
  
  // Images: self + data URIs + blob + any HTTPS
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
  ],
  
  // Media: self + Supabase storage + blob
  'media-src': [
    "'self'",
    'https://*.supabase.co',
    'blob:',
  ],
  
  // Fonts: self + data URIs + any HTTPS
  'font-src': [
    "'self'",
    'data:',
    'https:',
  ],
  
  // Connections: self + APIs + WebSocket (dev only)
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.openai.com', // Mantido para compatibilidade
    'https://api.anthropic.com', // Anthropic Claude API
    'https://connect.facebook.net',
    'https://*.facebook.net',
    'https://*.similarweb.com',
    'https://cdn.similarweb.com',
    'https://*.contentsquare.net',
    'https://t.contentsquare.net',
  ],
  
  // Frames: specific domains only
  'frame-src': [
    "'self'",
    'blob:',
    'data:',
    'https://connect.facebook.net',
    'https://*.facebook.net',
    'https://safeframe.googlesyndication.com',
    'https://*.similarweb.com',
    'https://*.contentsquare.net',
  ],
  
  // Workers: self + blob + Contentsquare
  'worker-src': [
    "'self'",
    'blob:',
    'https://*.contentsquare.net',
  ],
  
  // Security: no object/embed
  'object-src': ["'none'"],
  
  // Base URI: self only
  'base-uri': ["'self'"],
  
  // Form actions: self only
  'form-action': ["'self'"],
  
  // Frame ancestors: none (prevent clickjacking)
  'frame-ancestors': ["'none'"],
  
  // Upgrade insecure requests in production
  'upgrade-insecure-requests': [],
};

/**
 * Development-specific additions
 */
const devAdditions = {
  'script-src': [
    "'unsafe-eval'", // Required for Vite HMR
    // Note: 'unsafe-inline' removed - using hashes instead
  ],
  'script-src-elem': [
    "'unsafe-inline'", // Required for Vite dynamic scripts and HMR in development
    // NOTA: 'unsafe-eval' não é permitido em script-src-elem, apenas em script-src
    // Scripts dinâmicos gerados pelo Vite não podem ter hashes pré-calculados
    // Em produção, apenas scripts estáticos do index.html são permitidos (via hashes)
  ],
  'script-src-attr': [
    "'unsafe-hashes'", // Allow hashed event handlers
    // Hashes para event handlers inline gerados dinamicamente
    "'sha256-4TpZ3Tx5SLybDXPQaSHGuP1RU4D+pzck+02JLVY61BY='",
    "'sha256-5o6pEK3LvCTq+T5Hmtrd52WX2S+TpCCTdAXXa1042Y0='",
    // NOTA: 'unsafe-inline' é ignorado quando há hashes, então removido
    // Em desenvolvimento, usar apenas 'unsafe-hashes' com hashes específicos
    // Em produção, usar apenas hashes específicos
  ],
  'style-src': [
    "'unsafe-inline'", // Required for Tailwind dev mode
  ],
  'style-src-elem': [
    "'unsafe-inline'", // Required for Tailwind dev mode
  ],
  'connect-src': [
    'ws://localhost:*',
    'ws://127.0.0.1:*',
    'wss://localhost:*',
    'wss://127.0.0.1:*',
    'http://localhost:*',
    'http://127.0.0.1:*',
    'http://192.168.0.9:*',
    'ws://192.168.0.9:*',
    'wss://192.168.0.9:*',
    // Portas específicas do Vite (8089 padrão, 8090 alternativa)
    'http://localhost:8089',
    'http://localhost:8090',
    'ws://localhost:8089',
    'ws://localhost:8090',
    'wss://localhost:8089',
    'wss://localhost:8090',
    // NOTA: CSP não suporta wildcards como 192.168.*:*
    // Para desenvolvimento em rede local, adicione IPs específicos conforme necessário
    // Exemplo: 'ws://192.168.1.100:*' para outro IP da rede
  ],
};

/**
 * Report-Only configuration
 * 
 * Use a service like report-uri.com or implement your own endpoint
 * REMOVIDO: report-uri estava retornando 400 Bad Request
 * Para ativar novamente, configure um endpoint válido ou remova a diretiva report-uri
 */
// const REPORT_URI = 'https://report-uri.com/a/d/o'; // Desabilitado - retornava 400

/**
 * Get CSP directives for a specific environment
 */
export function getCSPDirectives(isDev: boolean = false): CSPDirectives {
  const directives: CSPDirectives = { ...baseDirectives };
  
  if (isDev) {
    // Merge dev additions
    directives['script-src'] = [
      ...directives['script-src'],
      ...devAdditions['script-src'],
    ];
    directives['script-src-elem'] = [
      ...directives['script-src-elem'],
      ...devAdditions['script-src-elem'],
    ];
    // Merge script-src-attr for development
    // script-src-attr já está definida em baseDirectives, então mesclar com devAdditions
    if (devAdditions['script-src-attr']) {
      // Garantir que script-src-attr existe antes de mesclar
      if (!directives['script-src-attr']) {
        directives['script-src-attr'] = [];
      }
      directives['script-src-attr'] = [
        ...directives['script-src-attr'],
        ...devAdditions['script-src-attr'],
      ];
    }
    // Garantir que script-src-attr está definida mesmo se não houver devAdditions
    if (!directives['script-src-attr']) {
      directives['script-src-attr'] = baseDirectives['script-src-attr'] || [];
    }
    directives['style-src'] = [
      ...directives['style-src'],
      ...devAdditions['style-src'],
    ];
    directives['style-src-elem'] = [
      ...directives['style-src-elem'],
      ...devAdditions['style-src-elem'],
    ];
    directives['connect-src'] = [
      ...directives['connect-src'],
      ...devAdditions['connect-src'],
    ];
  } else {
    // Production: add upgrade-insecure-requests
    directives['upgrade-insecure-requests'] = [];
  }
  
  return directives;
}

/**
 * Convert CSP directives to header value string
 */
export function asHeaderValue(directives: CSPDirectives = getCSPDirectives(false)): string {
  const parts: string[] = [];
  
  for (const [key, values] of Object.entries(directives)) {
    // Skip undefined or null values
    if (!values) continue;
    
    if (values.length === 0 && key === 'upgrade-insecure-requests') {
      // Special case: upgrade-insecure-requests has no values
      parts.push(key);
    } else if (values.length > 0) {
      parts.push(`${key} ${values.join(' ')}`);
    }
  }
  
  return parts.join('; ');
}

/**
 * Get CSP directives for Report-Only mode
 */
export function getReportOnlyDirectives(isDev: boolean = false): CSPDirectives {
  const directives = getCSPDirectives(isDev);
  
  // REMOVIDO: upgrade-insecure-requests é ignorado em políticas report-only
  // Conforme especificação CSP, essa diretiva só funciona em políticas ativas
  delete directives['upgrade-insecure-requests'];
  
  // ✅ CORREÇÃO: Adicionar report-uri local para evitar aviso do navegador
  // Em desenvolvimento, usar endpoint local que simplesmente ignora os relatórios
  // Isso evita o aviso "sem diretiva report-uri nem report-to"
  if (isDev) {
    // Usar endpoint local que não faz nada (apenas para suprimir o aviso)
    // O navegador tentará enviar relatórios, mas como é localhost, não causará problemas
    directives['report-uri'] = ['/csp-report'];
  }
  
  return directives;
}

/**
 * Convert CSP directives to Report-Only header value string
 */
export function asReportOnlyHeaderValue(isDev: boolean = false): string {
  return asHeaderValue(getReportOnlyDirectives(isDev));
}

/**
 * Update inline script hashes
 * Call this after calculating hashes for inline scripts
 */
export function updateInlineScriptHashes(hashes: Partial<typeof INLINE_SCRIPT_HASHES>) {
  Object.assign(INLINE_SCRIPT_HASHES, hashes);
}

/**
 * Get current inline script hashes (for documentation)
 */
export function getInlineScriptHashes() {
  return { ...INLINE_SCRIPT_HASHES };
}
