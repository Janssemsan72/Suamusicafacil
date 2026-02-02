// Utilitários de segurança para o sistema de preços regionalizados

// Hash do IP para privacidade (LGPD/GDPR)
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'musiclovely_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Criptografar session token com dados do usuário
export async function encryptSessionToken(sessionData: {
  country: string;
  region: string;
  ip_hash: string;
  timestamp: number;
}): Promise<string> {
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('musiclovely_secret_key_2025'),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(sessionData));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    secretKey,
    data
  );

  // Combinar IV + dados criptografados
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Converter para base64
  return btoa(String.fromCharCode(...combined));
}

// Descriptografar session token
export async function decryptSessionToken(encryptedToken: string): Promise<{
  country: string;
  region: string;
  ip_hash: string;
  timestamp: number;
} | null> {
  try {
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('musiclovely_secret_key_2025'),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decodificar base64
    const combined = new Uint8Array(
      atob(encryptedToken).split('').map(char => char.charCodeAt(0))
    );

    // Separar IV e dados criptografados
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      secretKey,
      encrypted
    );

    const decryptedData = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedData);
  } catch (error) {
    console.error('Erro ao descriptografar token:', error);
    return null;
  }
}

// Validar session token
export async function validateSessionToken(
  token: string,
  currentIP: string
): Promise<{
  valid: boolean;
  sessionData?: any;
  reason?: string;
}> {
  try {
    const sessionData = await decryptSessionToken(token);
    
    if (!sessionData) {
      return { valid: false, reason: 'Token inválido' };
    }

    // Verificar se o token não expirou (24 horas)
    const now = Date.now();
    const tokenAge = now - sessionData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    if (tokenAge > maxAge) {
      return { valid: false, reason: 'Token expirado' };
    }

    // Verificar se o IP ainda é o mesmo (hash)
    const currentIPHash = await hashIP(currentIP);
    if (currentIPHash !== sessionData.ip_hash) {
      return { valid: false, reason: 'IP alterado' };
    }

    return { valid: true, sessionData };
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return { valid: false, reason: 'Erro de validação' };
  }
}

// Detectar VPN (simulação - em produção usar serviço real)
export async function detectVPN(ip: string): Promise<{
  isVPN: boolean;
  confidence: number;
  provider?: string;
}> {
  try {
    // Simular detecção de VPN
    // Em produção, usar serviços como:
    // - ipapi.co/vpn/
    // - ipqualityscore.com
    // - ipgeolocation.io
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (response.ok) {
      const data = await response.json();
      
      // Verificar se é VPN baseado em características comuns
      const isVPN = data.org?.toLowerCase().includes('vpn') ||
                   data.org?.toLowerCase().includes('proxy') ||
                   data.org?.toLowerCase().includes('hosting') ||
                   data.connection?.type === 'hosting';

      return {
        isVPN,
        confidence: isVPN ? 0.8 : 0.2,
        provider: data.org
      };
    }
  } catch (error) {
    console.warn('Erro ao detectar VPN:', error);
  }

  return { isVPN: false, confidence: 0 };
}

// Detectar atividades suspeitas
export async function detectSuspiciousActivity(
  ip: string,
  country: string,
  region: string,
  userAgent: string
): Promise<{
  suspicious: boolean;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high';
}> {
  const reasons: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  try {
    // 1. Verificar VPN
    const vpnCheck = await detectVPN(ip);
    if (vpnCheck.isVPN) {
      reasons.push('VPN detectada');
      riskLevel = 'medium';
    }

    // 2. Verificar User Agent suspeito
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      reasons.push('User Agent suspeito');
      riskLevel = 'high';
    }

    // 3. Verificar se é IP de hosting conhecido
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      reasons.push('IP privado');
      riskLevel = 'medium';
    }

    // 4. Verificar mudanças rápidas de país (seria implementado com histórico)
    // Esta verificação seria feita no backend com histórico de sessões

    return {
      suspicious: reasons.length > 0,
      reasons,
      riskLevel
    };
  } catch (error) {
    console.error('Erro ao detectar atividades suspeitas:', error);
    return {
      suspicious: false,
      reasons: [],
      riskLevel: 'low'
    };
  }
}

// Rate limiting por IP
export class RateLimiter {
  private static attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  static async checkRateLimit(
    ip: string,
    maxAttempts: number = 10,
    windowMs: number = 60 * 60 * 1000 // 1 hora
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const key = ip;
    
    const current = this.attempts.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset ou primeira tentativa
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetTime: now + windowMs
      };
    }
    
    if (current.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }
    
    // Incrementar contador
    current.count++;
    this.attempts.set(key, current);
    
    return {
      allowed: true,
      remaining: maxAttempts - current.count,
      resetTime: current.resetTime
    };
  }
}

// Log de atividades suspeitas
export async function logSuspiciousActivity(
  supabase: any,
  data: {
    ip_address_hash: string;
    detected_country: string;
    locked_region: string;
    activity_type: string;
    risk_level: string;
    user_agent?: string;
    order_id?: string;
  }
) {
  try {
    await supabase
      .from('purchase_analytics')
      .insert({
        ip_address_hash: data.ip_address_hash,
        detected_country: data.detected_country,
        locked_region: data.locked_region,
        suspicious_activity: true,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Erro ao registrar atividade suspeita:', error);
  }
}

// Validar região consistente
export function validateRegionConsistency(
  detectedCountry: string,
  lockedRegion: string,
  currentCountry?: string
): {
  valid: boolean;
  reason?: string;
} {
  const regionMap: Record<string, string> = {
    'BR': 'brasil',
    'US': 'usa',
    'GB': 'usa',
    'CA': 'usa',
    'AU': 'usa',
    'NZ': 'usa',
    'ES': 'internacional',
    'MX': 'internacional',
    'AR': 'internacional',
    'CO': 'internacional',
    'CL': 'internacional',
    'PE': 'internacional'
  };

  const expectedRegion = regionMap[detectedCountry] || 'internacional';
  
  if (expectedRegion !== lockedRegion) {
    return {
      valid: false,
      reason: `Região inconsistente: ${detectedCountry} deveria ser ${expectedRegion}, mas está ${lockedRegion}`
    };
  }

  // Se há mudança de país, verificar se é da mesma região
  if (currentCountry && currentCountry !== detectedCountry) {
    const currentRegion = regionMap[currentCountry] || 'internacional';
    if (currentRegion !== lockedRegion) {
      return {
        valid: false,
        reason: `Mudança de país inválida: ${currentCountry} (${currentRegion}) não é compatível com ${lockedRegion}`
      };
    }
  }

  return { valid: true };
}
