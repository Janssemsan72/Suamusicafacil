import { memo, useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { ComponentType } from "react";

// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de componentes abaixo do fold
// Componentes críticos (above-the-fold) mantidos como imports estáticos
// Componentes abaixo do fold carregados sob demanda

import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

// ✅ OTIMIZAÇÃO: QuizCheckoutModal lazy - evita carregar Supabase no initial load
const QuizCheckoutModal = lazyWithRetry(() => import("@/components/QuizCheckoutModal"));
import { scheduleOnFirstInteraction } from "@/utils/scheduleNonCriticalRender";
import {
  HowItWorksSkeleton,
  TestimonialsSkeleton,
  OccasionsGridSkeleton,
  WhatYouGetSkeleton,
  FAQSkeleton,
  FooterSkeleton,
} from "@/components/skeletons";

// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de componentes abaixo do fold para reduzir bundle inicial
const HowItWorks = lazyWithRetry(() => import("@/components/HowItWorks"));
const Testimonials = lazyWithRetry(() => import("@/components/Testimonials"));
const OccasionsGrid = lazyWithRetry(() => import("@/components/OccasionsGrid"));
const WhatYouGet = lazyWithRetry(() => import("@/components/WhatYouGet"));
const FAQ = lazyWithRetry(() => import("@/components/FAQ"));
const Footer = lazyWithRetry(() => import("@/components/Footer"));

// ✅ OTIMIZAÇÃO: DeferredHooks será carregado via dynamic import apenas após primeira interação
// Removido lazy() para evitar processamento prematuro pelo Vite


const Index = memo(() => {
  // ✅ OTIMIZAÇÃO: Hooks pesados serão carregados via DeferredHooks (dynamic import)
  // ✅ OTIMIZAÇÃO CRÍTICA: Carregar DeferredHooks apenas após primeira interação ou scroll
  const [DeferredHooksComponent, setDeferredHooksComponent] = useState<ComponentType | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const openQuizModal = useCallback(() => {
    setIsQuizModalOpen(true);
  }, []);

  const closeQuizModal = useCallback(() => {
    setIsQuizModalOpen(false);
  }, []);

  // ✅ OTIMIZAÇÃO: Abrir modal quando redirecionado de /quiz ou /checkout com open_quiz=1 (preserva UTMs na URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("open_quiz") === "1") {
      openQuizModal();
      const next = new URLSearchParams(params);
      next.delete("open_quiz");
      const search = next.toString();
      navigate({ pathname: "/", search: search ? `?${search}` : "" }, { replace: true });
    }
  }, [openQuizModal, navigate]); // Dependências corretas

  // ✅ OTIMIZAÇÃO: Handle deep links with hash - simplificado e mais eficiente
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    const scrollToHash = () => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };

    if (!scrollToHash()) {
      const observer = new MutationObserver((_, obs) => {
        if (scrollToHash()) obs.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 3000); // Timeout de 3s
    }
  }, []);

  // ✅ OTIMIZAÇÃO CRÍTICA: Carregar DeferredHooks apenas após primeira interação ou scroll usando dynamic import
  useEffect(() => {
    if (DeferredHooksComponent) return;
    let isActive = true;

    const cancel = scheduleOnFirstInteraction(() => {
      // ✅ PREFETCH MANUAL: Iniciar prefetch de componentes críticos assim que o usuário interage
      QuizCheckoutModal.prefetch();
      HowItWorks.prefetch();
      WhatYouGet.prefetch?.(); // VinylPlayer (botão "Ouça este Exemplo") fica pronto mais cedo
      
      (async () => {
        try {
          const module = await import("@/components/DeferredHooks");
          if (!isActive) return;
          setDeferredHooksComponent(() => module.DeferredHooks);
        } catch (error) {
          console.error('Erro ao carregar DeferredHooks:', error);
        }
      })();
    }, { timeoutMs: 10000 });

    return () => {
      isActive = false;
      cancel();
    };
  }, [DeferredHooksComponent]);

  // ✅ OTIMIZAÇÃO: Metadados dinâmicos para SEO leve
  useEffect(() => {
    document.title = "Sua Música Fácil — Músicas Personalizadas Profissionais";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Crie minha música personalizada agora. Transforme sentimentos em canções únicas com qualidade de estúdio e entrega rápida.");
    }
  }, []);

  // ✅ OTIMIZAÇÃO: Prefetch manual do Quiz para percepção de site nativo
  const prefetchQuiz = useCallback(() => {
    // Carregar o modal e o fluxo do quiz antecipadamente
    QuizCheckoutModal.prefetch?.();
    HowItWorks.prefetch?.();
    console.log("Prefetching critical components...");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-cream-100" onTouchStart={prefetchQuiz}>
      {/* ✅ OTIMIZAÇÃO: Hooks pesados carregados apenas após primeira interação ou scroll */}
      {DeferredHooksComponent && <DeferredHooksComponent />}
      
      <Header onOpenQuiz={openQuizModal} />
      
      <main className="flex-1" role="main" onMouseEnter={prefetchQuiz}>
        <HeroSection onOpenQuiz={openQuizModal} />

        {/* Main Content - Skeletons + content-visibility para percepção de velocidade */}
        <div className="below-fold-section">
          <Suspense fallback={<HowItWorksSkeleton />}>
            <HowItWorks onOpenQuiz={openQuizModal} />
          </Suspense>
        </div>
        <div className="below-fold-section">
          <Suspense fallback={<TestimonialsSkeleton />}>
            <Testimonials />
          </Suspense>
        </div>
        <div className="below-fold-section">
          <Suspense fallback={<OccasionsGridSkeleton />}>
            <OccasionsGrid onOpenQuiz={openQuizModal} />
          </Suspense>
        </div>
        <div className="below-fold-section">
          <Suspense fallback={<WhatYouGetSkeleton />}>
            <WhatYouGet onOpenQuiz={openQuizModal} />
          </Suspense>
        </div>
        <div className="below-fold-section">
          <Suspense fallback={<FAQSkeleton />}>
            <FAQ />
          </Suspense>
        </div>
      </main>

      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>

      {isQuizModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        }>
          <QuizCheckoutModal isOpen={isQuizModalOpen} onClose={closeQuizModal} />
        </Suspense>
      )}
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
