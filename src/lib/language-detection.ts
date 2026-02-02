// Sistema de detecção de idioma - apenas pt suportado

export type SupportedLocale = 'pt';

const SUPPORTED_LOCALES: SupportedLocale[] = ['pt'];
const DEFAULT_LOCALE: SupportedLocale = 'pt';

// Listas de países por idioma (para futura detecção via headers de edge, sem uso de fetch)
export const PT_COUNTRIES = [
	'BR','PT','AO','MZ','CV','GW','ST','TL','MO'
];

export const ES_COUNTRIES = [
	'ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR'
];

export const EN_COUNTRIES = [
	'US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF'
];

export function mapCountryToLanguage(country?: string | null): SupportedLocale {
	if (!country) return DEFAULT_LOCALE;
	const code = country.toUpperCase();
	if (PT_COUNTRIES.includes(code)) return 'pt';
	if (ES_COUNTRIES.includes(code)) return 'es';
	if (EN_COUNTRIES.includes(code)) return 'en';
	return DEFAULT_LOCALE;
}

export function detectFromUrl(pathname: string): SupportedLocale | null {
	const segments = pathname.split('/').filter(Boolean);
	const first = segments[0];
	if (first && (SUPPORTED_LOCALES as string[]).includes(first)) {
		return first as SupportedLocale;
	}
	return null;
}

export function detectFromNavigator(): SupportedLocale | null {
	try {
		const lang = (navigator?.language || '').toLowerCase();
		if (!lang) return null;
		if (lang.startsWith('pt')) return 'pt';
		return null;
	} catch {
		return null;
	}
}

// Para SSR/edge futuro: permite passar cabeçalhos já resolvidos pelo provedor
export function detectFromCountryHeader(countryHeader?: string | null): SupportedLocale | null {
	if (!countryHeader) return null;
	return mapCountryToLanguage(countryHeader);
}

export function detectLanguage(pathname: string, countryHeader?: string | null): SupportedLocale {
	// 1) URL
	const urlLocale = detectFromUrl(pathname);
	if (urlLocale) return urlLocale;

	// 2) Navigator
	const navLocale = detectFromNavigator();
	if (navLocale) return navLocale;

	// 3) Header de país (quando disponível via edge, ignorado em localhost)
	const headerLocale = detectFromCountryHeader(countryHeader);
	if (headerLocale) return headerLocale;

	// 4) Fallback
	return DEFAULT_LOCALE;
}


