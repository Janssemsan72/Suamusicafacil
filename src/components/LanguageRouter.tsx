import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PublicRoutes from './PublicRoutes';
import { detectLanguage, type SupportedLocale } from '@/lib/language-detection';
import { getCurrentLocale, removeLocalePrefix } from '@/lib/i18nRoutes';
import { detectLocaleAtEdge, normalizeSimpleLocale } from '@/lib/edgeLocale';

export default function LanguageRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isResolving, setIsResolving] = useState(false);

  const needsRedirect = useMemo(() => {
    const pathname = location.pathname;
    const currentLocale = getCurrentLocale(pathname);
    // Se já tem prefixo válido, não precisamos resolver nada
    return !currentLocale;
  }, [location.pathname]);

  useEffect(() => {
    if (!needsRedirect || isResolving) return;
    const run = async () => {
      setIsResolving(true);
      const pathname = location.pathname;

      // 1) Tentar via Edge Function
      let detected: SupportedLocale | null = null;
      try {
        const edge = await detectLocaleAtEdge();
        const edgeLang = normalizeSimpleLocale(edge?.language);
        if (edgeLang) detected = edgeLang as SupportedLocale;
      } catch {}

      // 2) Fallback local: URL > Navigator > Header > en
      if (!detected) detected = detectLanguage(pathname);

      const clean = removeLocalePrefix(pathname);
      const target = `/${detected}${clean}`;
      if (target !== pathname) {
        navigate(target, { replace: true });
      }
      setIsResolving(false);
    };
    run();
  }, [needsRedirect, isResolving, location.pathname, navigate]);

  // Se o usuário acessa exatamente "/pt" | "/en" | "/es", redireciona para a home com barra final
  useEffect(() => {
    const pathname = location.pathname;
    const currentLocale = getCurrentLocale(pathname);
    if (currentLocale && (pathname === `/${currentLocale}`)) {
      const target = `/${currentLocale}/`;
      if (target !== pathname) {
        navigate(target, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  // Evitar render até concluir redirect, para impedir flash em "/"
  if (needsRedirect || isResolving) return null;
  return <PublicRoutes />;
}


