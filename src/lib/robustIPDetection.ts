export type Locale = 'pt' | 'es' | 'en';

interface IPDetectionResult {
  countryCode: string | null;
  countryName: string | null;
  source: string;
}

interface IPAPIResponse {
  country_code?: string;
  country_name?: string;
  country?: string;
  countryCode?: string;
  status?: string;
}

/**
 * Sistema robusto de detecção de IP com múltiplas APIs e fallbacks
 */
export class RobustIPDetection {
  private static readonly APIS = [
    {
      name: 'ipapi.co',
      url: 'https://ipapi.co/json/',
      parser: (data: any): IPDetectionResult => ({
        countryCode: data.country_code,
        countryName: data.country_name,
        source: 'ipapi.co'
      })
    },
    {
      name: 'ipinfo.io',
      url: 'https://ipinfo.io/json',
      parser: (data: any): IPDetectionResult => ({
        countryCode: data.country,
        countryName: data.country,
        source: 'ipinfo.io'
      })
    }
  ];

  /**
   * Detecta o país usando múltiplas APIs com fallback
   */
  static async detectCountry(): Promise<IPDetectionResult | null> {
    console.log('🌍 [RobustIPDetection] Iniciando detecção robusta de país...');
    
    for (const api of this.APIS) {
      try {
        console.log(`🌍 [RobustIPDetection] Tentando API: ${api.name}`);
        
        const response = await fetch(api.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Timeout de 5 segundos
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          const result = api.parser(data);
          
          if (result.countryCode) {
            console.log(`🌍 [RobustIPDetection] Sucesso com ${api.name}:`, result);
            return result;
          }
        } else {
          console.warn(`⚠️ [RobustIPDetection] API ${api.name} retornou status:`, response.status);
        }
      } catch (error) {
        console.warn(`⚠️ [RobustIPDetection] Erro na API ${api.name}:`, error);
        continue;
      }
    }
    
    console.warn('⚠️ [RobustIPDetection] Todas as APIs falharam');
    return null;
  }

  /**
   * Mapeia código do país para idioma
   */
  static mapCountryToLocale(_countryCode: string): Locale {
    return 'pt';
  }

  /**
   * Detecta idioma com prioridades: localStorage > cookie > navigator > IP > default
   */
  static async detectLocale(): Promise<Locale> {
    console.log('🌍 [RobustIPDetection] Iniciando detecção robusta de idioma...');
    
    // 1. Verificar localStorage
    const storedLang = localStorage.getItem('suamusicafacil_language');
    if (storedLang === 'pt') {
      console.log('🌍 [RobustIPDetection] Usando idioma do localStorage:', storedLang);
      return storedLang as Locale;
    }
    
    // 2. Verificar cookie
    const cookieLang = document.cookie.split(';').find(c => c.trim().startsWith('lang='))?.split('=')[1];
    if (cookieLang === 'pt') {
      console.log('🌍 [RobustIPDetection] Usando idioma do cookie:', cookieLang);
      return cookieLang as Locale;
    }
    
    // 3. Verificar navigator.language
    const navigatorLang = navigator.language.toLowerCase();
    if (navigatorLang.includes('pt')) {
      console.log('🌍 [RobustIPDetection] Usando idioma do navigator: pt');
      return 'pt';
    }
    
    // 4. Detectar por IP
    try {
      const ipResult = await this.detectCountry();
      if (ipResult?.countryCode) {
        const detectedLocale = this.mapCountryToLocale(ipResult.countryCode);
        console.log('🌍 [RobustIPDetection] Idioma detectado por IP:', detectedLocale, 'país:', ipResult.countryCode);
        return detectedLocale;
      }
    } catch (error) {
      console.warn('⚠️ [RobustIPDetection] Erro na detecção por IP:', error);
    }
    
    // 5. Fallback para português
    console.log('🌍 [RobustIPDetection] Usando idioma padrão: pt');
    return 'pt';
  }

  /**
   * Salva preferência de idioma
   */
  static saveLocalePreference(locale: Locale): void {
    try {
      localStorage.setItem('suamusicafacil_language', locale);
      document.cookie = `lang=${locale};path=/;max-age=${60*60*24*365};samesite=lax`;
      console.log('🌍 [RobustIPDetection] Preferência salva:', locale);
    } catch (error) {
      console.warn('⚠️ [RobustIPDetection] Erro ao salvar preferência:', error);
    }
  }
}

export default RobustIPDetection;
