declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

const USER_DATA_KEY = 'smf_user_data';
const TRACKING_STORAGE_KEY = 'suamusicafacil_tracking_params';
const LEGACY_STORAGE_KEY = 'musiclovely_tracking_params';

function isTrackingEnabled(): boolean {
  const path = window.location.pathname || '';
  if (path.startsWith('/admin') || path.startsWith('/app/admin')) return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return false;
  return true;
}

async function sha256Hash(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, days: number): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value};expires=${expires};path=/;domain=.suamusicafacil.com.br;SameSite=Lax`;
  } catch {
    // cookie access may fail
  }
}

// ---------------------------------------------------------------------------
// fbc — capture fbclid and generate _fbc cookie
// ---------------------------------------------------------------------------

function getFbclid(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('fbclid');
    if (fromUrl) return fromUrl;

    const saved = localStorage.getItem(TRACKING_STORAGE_KEY)
      || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const params = JSON.parse(saved);
      if (params.fbclid) return params.fbclid;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getOrCreateFbc(): string | null {
  const existing = getCookie('_fbc');
  if (existing) return existing;

  const fbclid = getFbclid();
  if (!fbclid) return null;

  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  setCookie('_fbc', fbc, 90);
  return fbc;
}

function getFbp(): string | null {
  return getCookie('_fbp');
}

// ---------------------------------------------------------------------------
// external_id via sck
// ---------------------------------------------------------------------------

export function getOrCreateSck(): string {
  try {
    const saved = localStorage.getItem(TRACKING_STORAGE_KEY)
      || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const params = JSON.parse(saved);
      if (params.sck) return params.sck;
    }
  } catch {
    // ignore
  }

  const sck = crypto.randomUUID();
  try {
    const saved = localStorage.getItem(TRACKING_STORAGE_KEY);
    const params = saved ? JSON.parse(saved) : {};
    params.sck = sck;
    localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // ignore
  }
  return sck;
}

// ---------------------------------------------------------------------------
// em/ph hash persistence (FB CAPI Advanced Matching)
// ---------------------------------------------------------------------------

interface PersistedUserData {
  em?: string;
  ph?: string;
  country?: string;
}

export async function storeHashedUserData(email: string, phone: string): Promise<void> {
  const [em, ph, country] = await Promise.all([
    sha256Hash(email),
    sha256Hash(phone.replace(/\D/g, '')),
    sha256Hash('br'),
  ]);

  const data: PersistedUserData = {};
  if (em) data.em = em;
  if (ph) data.ph = ph;
  if (country) data.country = country;

  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getPersistedUserData(): PersistedUserData {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

// ---------------------------------------------------------------------------
// Enriched user_data builder
// ---------------------------------------------------------------------------

function buildUserData(): Record<string, string> {
  const userData: Record<string, string> = {};

  const persisted = getPersistedUserData();
  if (persisted.em) userData.em = persisted.em;
  if (persisted.ph) userData.ph = persisted.ph;
  if (persisted.country) userData.country = persisted.country;

  userData.external_id = getOrCreateSck();

  const fbc = getOrCreateFbc();
  if (fbc) userData.fbc = fbc;

  const fbp = getFbp();
  if (fbp) userData.fbp = fbp;

  return userData;
}

// ---------------------------------------------------------------------------
// Core: pushToDataLayer (auto-enriched with user_data + event_id)
// ---------------------------------------------------------------------------

export function pushToDataLayer(event: string, data?: Record<string, unknown>): void {
  if (!isTrackingEnabled()) return;
  try {
    window.dataLayer = window.dataLayer || [];

    const userData = buildUserData();
    const eventUserData = (data?.user_data as Record<string, string>) || {};
    const mergedUserData = { ...userData, ...eventUserData };

    const enriched: Record<string, unknown> = {
      event,
      event_id: crypto.randomUUID(),
      ...data,
      user_data: mergedUserData,
    };

    window.dataLayer.push(enriched);
  } catch {
    // silently ignore tracking errors
  }
}

// ---------------------------------------------------------------------------
// Event-specific tracking functions
// ---------------------------------------------------------------------------

export function trackPageView(pagePath: string, pageTitle: string): void {
  pushToDataLayer('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

export function trackQuizStart(aboutWho: string, occasion: string): void {
  pushToDataLayer('quiz_start', {
    about_who: aboutWho,
    occasion,
  });
}

export function trackQuizComplete(quizId: string, aboutWho: string, musicStyle: string): void {
  pushToDataLayer('quiz_complete', {
    quiz_id: quizId,
    about_who: aboutWho,
    music_style: musicStyle,
  });
}

export function trackBeginCheckout(orderId: string, value: number, currency: string): void {
  pushToDataLayer('begin_checkout', {
    ecommerce: {
      transaction_id: orderId,
      value,
      currency,
      items: [{ item_name: 'Música Personalizada', price: value, quantity: 1 }],
    },
  });
}

function stripPiiFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export interface RedirectToPaymentParams {
  orderId: string;
  checkoutUrl?: string;
  value?: number;
  currency?: string;
}

export function trackRedirectToPayment(params: RedirectToPaymentParams): void {
  const { orderId, checkoutUrl, value, currency } = params;

  pushToDataLayer('redirect_to_payment', {
    order_id: orderId,
    payment_provider: 'cakto',
    checkout_url: checkoutUrl ? stripPiiFromUrl(checkoutUrl) : '',
    value: value ?? 0,
    currency: currency || 'BRL',
    content_name: 'Música Personalizada',
  });
}

// ---------------------------------------------------------------------------
// GA4 Client ID (for server-side purchase tracking)
// ---------------------------------------------------------------------------

export function getGAClientId(): string | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(.+?)(?:;|$)/);
    if (match?.[1]) return match[1];

    const ga4Match = document.cookie.match(/(?:^|;\s*)_ga_[A-Z0-9]+=GS\d+\.\d+\.(.+?)(?:;|$)/);
    if (ga4Match?.[1]) {
      const parts = ga4Match[1].split('.');
      if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
    }
  } catch {
    // cookie access may fail
  }
  return null;
}
