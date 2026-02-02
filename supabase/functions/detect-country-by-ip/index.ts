import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSecureHeaders } from "../_shared/security-headers.ts";

const PT_COUNTRIES = new Set(['BR','PT','AO','MZ','CV','GW','ST','TL','MO']);
const ES_COUNTRIES = new Set(['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN','PY','SV','NI','CR','PA','UY','GQ','PR']);
const EN_COUNTRIES = new Set(['US','GB','CA','AU','NZ','IE','ZA','NG','KE','GH','UG','TZ','ZW','ZM','BW','LS','SZ','MW','JM','BB','TT','GY','BZ','AG','BS','DM','GD','KN','LC','VC','SG','MY','PH','IN','PK','BD','LK','MM','FJ','PG','SB','VU','TO','WS','KI','TV','NR','PW','FM','MH','CK','NU','TK','NF']);

function mapCountryToLanguage(code?: string | null): 'pt' | 'es' | 'en' {
  if (!code) return 'en';
  const c = code.toUpperCase();
  if (PT_COUNTRIES.has(c)) return 'pt';
  if (ES_COUNTRIES.has(c)) return 'es';
  if (EN_COUNTRIES.has(c)) return 'en';
  return 'en';
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = getSecureHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const ip = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || undefined;

    const token = Deno.env.get('IPINFO_TOKEN');
    const base = 'https://ipinfo.io';
    const endpoint = ip ? `${base}/${ip}/json` : `${base}/json`;
    const url = token ? `${endpoint}?token=${token}` : endpoint;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 700);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ language: 'en', country: null, ip: ip || null, source: 'fallback' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const data = await res.json();
    const country = data?.country as string | undefined;
    const language = mapCountryToLanguage(country || null);

    return new Response(
      JSON.stringify({ language, country: country || null, ip: ip || null, source: 'ipinfo' }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ language: 'en', country: null, error: (e as Error).message }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
