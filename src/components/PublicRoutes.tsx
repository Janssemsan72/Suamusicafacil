import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
// ✅ OTIMIZAÇÃO: Index mantido como import estático porque contém Header e HeroSection (críticos para FCP/LCP)
// Componentes abaixo do fold já são lazy dentro do Index
import Index from "../pages/Index";

// ✅ OTIMIZAÇÃO: Lazy load do CheckoutRedirectWrapper - carregar apenas quando necessário
const CheckoutRedirectWrapper = lazyWithRetry(() => import("./CheckoutRedirectWrapper").then(m => ({ default: m.default })));

// ✅ CORREÇÃO: Lazy load com retry para resolver "Failed to fetch dynamically imported module"
const IndexCompany = lazyWithRetry(() => import("../pages/IndexCompany"));
const About = lazyWithRetry(() => import("../pages/About"));
const Company = lazyWithRetry(() => import("../pages/Company"));
const CompanyStandalone = lazyWithRetry(() => import("../pages/CompanyStandalone"));
const HowItWorks = lazyWithRetry(() => import("../pages/HowItWorks"));
const Pricing = lazyWithRetry(() => import("../pages/Pricing"));
const Terms = lazyWithRetry(() => import("../pages/Terms"));
const Privacy = lazyWithRetry(() => import("../pages/Privacy"));
const CheckoutProcessing = lazyWithRetry(() => import("../pages/CheckoutProcessing"));
const PaymentSuccess = lazyWithRetry(() => import("../pages/PaymentSuccess"));
const SongDownload = lazyWithRetry(() => import("../pages/SongDownload"));
const ApproveLyrics = lazyWithRetry(() => import("../pages/ApproveLyrics"));
const OrderPublicPage = lazyWithRetry(() => import("../pages/OrderPublicPage"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));

/** Redireciona /quiz para /?open_quiz=1 preservando query params (UTMs, etc.) */
function QuizRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("open_quiz", "1");
  const to = params.toString() ? `/?${params.toString()}` : "/?open_quiz=1";
  return <Navigate to={to} replace />;
}

/** Redireciona /checkout para /?open_quiz=1 preservando query params (UTMs, etc.) */
function CheckoutRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("open_quiz", "1");
  const to = params.toString() ? `/?${params.toString()}` : "/?open_quiz=1";
  return <Navigate to={to} replace />;
}

const RouteFallback = () => (
  <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #fdf2f8 100%)" }}>
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", padding: "0 16px" }}>
      <div
        style={{
          width: "100%",
          padding: "32px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ height: 20, width: "50%", borderRadius: 10, background: "rgba(139,92,246,0.10)", margin: "0 auto 16px" }} />
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(139,92,246,0.08)", margin: "0 auto 16px" }} />
        <div style={{ height: 18, width: "60%", borderRadius: 10, background: "rgba(139,92,246,0.08)", margin: "0 auto 10px" }} />
        <div style={{ height: 14, width: "75%", borderRadius: 10, background: "rgba(139,92,246,0.06)", margin: "0 auto" }} />
      </div>
    </div>
  </div>
);

// ✅ CORREÇÃO: Sempre renderizar rotas - React Router lida com paths automaticamente
export default function PublicRoutes() {
  const location = useLocation();
  // Verificar se estamos no projeto music-lovely-novo ou musiclovely.shop (usando hostname)
  // Para esses projetos, sempre usar IndexCompany como página inicial
  const isCompanyPage = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('musiclovely-novo') || 
     window.location.hostname.includes('music-lovely-novo') ||
     window.location.hostname === 'musiclovely-novo.vercel.app' ||
     window.location.hostname.includes('musiclovely.shop') ||
     window.location.hostname === 'www.musiclovely.shop' ||
     import.meta.env.VITE_PROJECT_NAME === 'music-lovely-novo');
  
  // ✅ NOVO: Para musiclovely.shop, renderizar APENAS a página Company em todas as rotas
  const isMusicLovelyShopOnly = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('musiclovely.shop') ||
     window.location.hostname === 'www.musiclovely.shop');
  
  // Se for musiclovely.shop, renderizar apenas Company em todas as rotas
  if (isMusicLovelyShopOnly) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="*" element={<Company />} />
        </Routes>
      </Suspense>
    );
  }

  const shouldUseCheckoutRedirectWrapper =
    location.search.includes('message_id=') ||
    location.search.includes('order_id=') ||
    location.search.includes('restore=true') ||
    location.search.includes('quiz_id=') ||
    location.search.includes('token=');

  const routes = (
    <Routes>
      <Route path="/" element={isCompanyPage ? <IndexCompany /> : <Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/company" element={<Company />} />
      <Route path="/company-standalone" element={<CompanyStandalone />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/quiz" element={<QuizRedirect />} />
      <Route path="/checkout" element={<CheckoutRedirect />} />
      <Route path="/checkout-processing" element={<CheckoutProcessing />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/success" element={<PaymentSuccess />} />
      <Route path="/song/:id" element={<SongDownload />} />
      <Route path="/download/:id" element={<SongDownload />} />
      <Route path="/download/:id/:token" element={<SongDownload />} />
      <Route path="/order/:token" element={<OrderPublicPage />} />
      <Route path="/approve-lyrics" element={<ApproveLyrics />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
  
  return (
    <Suspense fallback={<RouteFallback />}>
      {shouldUseCheckoutRedirectWrapper ? <CheckoutRedirectWrapper>{routes}</CheckoutRedirectWrapper> : routes}
    </Suspense>
  );
}
