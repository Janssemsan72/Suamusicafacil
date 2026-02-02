// ✅ SEGURANÇA: CORS seguro para edge functions
export const ALLOWED_ORIGINS = [
  'https://musiclovely.com',
  'https://www.musiclovely.com',
  'http://localhost:8084', // Manter para desenvolvimento
  'http://localhost:5173', // Manter para desenvolvimento
  'http://127.0.0.1:8084',
  'http://127.0.0.1:5173'
];

export const getCorsHeaders = (origin: string | null) => {
  // ✅ SEGURANÇA: Verificar se origin está na lista permitida
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 horas
  };
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
