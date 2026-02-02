/**
 * ✅ OTIMIZAÇÃO CRÍTICA: HeroShell isolado
 * Renderiza Header + HeroSection ANTES dos providers serem carregados
 * Isso melhora drasticamente FCP e LCP ao não bloquear renderização inicial
 * 
 * Renderiza apenas na rota "/" (home page)
 */
import { useLocation } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";

export function HeroShell() {
  const location = useLocation();
  
  // ✅ OTIMIZAÇÃO: Renderizar apenas na home page para não interferir em outras rotas
  if (location.pathname !== '/') {
    return null;
  }
  
  return (
    <>
      <Header />
      <HeroSection />
    </>
  );
}

