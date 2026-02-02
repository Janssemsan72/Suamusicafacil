// Mapear país para região comercial
export function mapCountryToRegion(country: string): string {
  const regionMap: Record<string, string> = {
    // Brasil
    'BR': 'brasil',
    
    // USA e países de língua inglesa
    'US': 'usa',
    'GB': 'usa', // Reino Unido -> USA (preço USD)
    'CA': 'usa', // Canadá -> USA (preço USD)
    'AU': 'usa', // Austrália -> USA (preço USD)
    'NZ': 'usa', // Nova Zelândia -> USA (preço USD)
    
    // Países de língua espanhola -> internacional
    'ES': 'internacional',
    'MX': 'internacional',
    'AR': 'internacional',
    'CO': 'internacional',
    'CL': 'internacional',
    'PE': 'internacional',
    'VE': 'internacional',
    'EC': 'internacional',
    'GT': 'internacional',
    'CU': 'internacional',
    'BO': 'internacional',
    'DO': 'internacional',
    'HN': 'internacional',
    'PY': 'internacional',
    'SV': 'internacional',
    'NI': 'internacional',
    'CR': 'internacional',
    'PA': 'internacional',
    'UY': 'internacional',
    'GQ': 'internacional',
  };
  
  return regionMap[country] || 'internacional'; // Padrão: internacional
}

// Mapear país para idioma
export function mapCountryToLanguage(country: string): string {
  const languageMap: Record<string, string> = {
    // Português
    'BR': 'pt',
    'PT': 'pt',
    'AO': 'pt',
    'MZ': 'pt',
    'CV': 'pt',
    'GW': 'pt',
    'ST': 'pt',
    'TL': 'pt',
    
    // Inglês
    'US': 'en',
    'GB': 'en',
    'CA': 'en',
    'AU': 'en',
    'NZ': 'en',
    'IE': 'en',
    'SG': 'en',
    'MY': 'en',
    'PH': 'en',
    'IN': 'en',
    'PK': 'en',
    'BD': 'en',
    'LK': 'en',
    'MM': 'en',
    'FJ': 'en',
    'PG': 'en',
    'SB': 'en',
    'VU': 'en',
    'TO': 'en',
    'WS': 'en',
    'KI': 'en',
    'TV': 'en',
    'NR': 'en',
    'PW': 'en',
    'FM': 'en',
    'MH': 'en',
    'CK': 'en',
    'NU': 'en',
    'TK': 'en',
    'NF': 'en',
    
    // Espanhol (padrão)
    'ES': 'es',
    'MX': 'es',
    'AR': 'es',
    'CO': 'es',
    'CL': 'es',
    'PE': 'es',
    'VE': 'es',
    'EC': 'es',
    'GT': 'es',
    'CU': 'es',
    'BO': 'es',
    'DO': 'es',
    'HN': 'es',
    'PY': 'es',
    'SV': 'es',
    'NI': 'es',
    'CR': 'es',
    'PA': 'es',
    'UY': 'es',
    'GQ': 'es',
  };
  
  return languageMap[country] || 'pt'; // Padrão: português
}

// Verificar se dois países estão na mesma região
export function isSameRegion(country1: string, country2: string): boolean {
  const region1 = mapCountryToRegion(country1);
  const region2 = mapCountryToRegion(country2);
  return region1 === region2;
}

// Obter flag do país
export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    'BR': '🇧🇷',
    'US': '🇺🇸',
    'ES': '🇪🇸',
    'MX': '🇲🇽',
    'AR': '🇦🇷',
    'CO': '🇨🇴',
    'CL': '🇨🇱',
    'PE': '🇵🇪',
    'OTHER': '🌍'
  };
  return flags[country] || '🌍';
}

// Obter nome da região
export function getRegionName(region: string): string {
  const names: Record<string, string> = {
    'brasil': 'Brasil',
    'usa': 'Estados Unidos',
    'internacional': 'Internacional'
  };
  return names[region] || region;
}

// Hash do IP para privacidade
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'musiclovely_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar session token
export function validateSessionToken(token: string): boolean {
  // Verificar se o token tem o formato correto (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

// Verificar se a sessão expirou
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
