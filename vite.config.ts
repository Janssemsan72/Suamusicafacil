import type { Connect, ViteDevServer } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { visualizer } from "rollup-plugin-visualizer";
import { ViteMinifyPlugin } from "vite-plugin-minify";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = mode !== 'production';
  const isBuild = command === 'build';

  const adminHtmlFallback = () => {
    return {
      name: "admin-html-fallback",
      configureServer(server: ViteDevServer) {
        server.middlewares.use((req: IncomingMessage & { url?: string }, _res: ServerResponse, next: Connect.NextFunction) => {
          const url = req.url ?? "";
          const accept = req.headers.accept ?? "";

          if (!accept.includes("text/html")) return next();
          if (!url.startsWith("/admin")) return next();
          if (url.startsWith("/admin.html")) return next();
          if (url.startsWith("/@")) return next();
          if (url.startsWith("/src/")) return next();

          const pathOnly = url.split("?")[0] ?? url;
          const hasFileExtension = /\.[a-z0-9]+$/i.test(pathOnly);
          if (hasFileExtension) return next();

          req.url = "/admin.html";
          return next();
        });
      },
    };
  };

  // ✅ OTIMIZAÇÃO CRÍTICA: Plugin para tornar CSS não bloqueante durante build
  const nonBlockingCSS = () => {
    return {
      name: "non-blocking-css",
      transformIndexHtml(html: string) {
        // Converter links de CSS bloqueantes em preload assíncrono
        return html.replace(
          /<link([^>]*)\s+rel=["']stylesheet["']([^>]*)>/gi,
          (match, before, after) => {
            // Verificar se já é preload ou se é fonte do Google
            if (match.includes('preload') || match.includes('fonts.googleapis.com') || match.includes('fonts.gstatic.com')) {
              return match;
            }
            // Extrair href
            const hrefMatch = match.match(/href=["']([^"']+)["']/);
            if (!hrefMatch || !hrefMatch[1]) return match;
            const href = hrefMatch[1];
            
            // Converter para preload assíncrono
            return `<link${before} rel="preload" as="style" href="${href}"${after} onload="this.onload=null;this.rel='stylesheet'"><noscript><link${before} rel="stylesheet" href="${href}"${after}></noscript>`;
          }
        );
      },
    };
  };
  
  return {
    // ✅ CRÍTICO: Base path explícito para garantir que funciona no Vercel
    base: '/',
    server: {
      host: "127.0.0.1",
      port: 5174,
      // ✅ FASE 4: Configurar HMR corretamente para WebSocket
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
        // ✅ FASE 4: Desabilitar overlay de erros do HMR para evitar loops
        overlay: false, // Desabilitar overlay pode ajudar a evitar loops de recarregamento
      },
      // strictPort: false permite fallback para 5175 quando 5174 está ocupada.
      // Se a página foi carregada de 5175 e o servidor reiniciou em 5174, o HMR
      // tentará reconectar em 5175 e gerará ERR_CONNECTION_REFUSED (suprimido em errorSuppression.ts).
      // Para forçar falha em conflito de porta (debug), use strictPort: true.
      strictPort: false,
      // ✅ FASE 4: Configurar watch para evitar loops de recarregamento
      watch: {
        // Ignorar mudanças que podem causar loops
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.cursor/**'],
        // ✅ FASE 4: Reduzir polling interval para evitar recarregamentos frequentes
        usePolling: false, // Desabilitar polling (usa eventos nativos do sistema)
      },
      headers: isDev ? {
        // CSP de desenvolvimento - amigável ao Vite/HMR
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://connect.facebook.net https://*.facebook.net",
          "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://*.facebook.net",
          "worker-src 'self' blob:",  // Permitir workers de blob
          "style-src 'self' 'unsafe-inline'",    // Fontes locais via @fontsource
          "style-src-elem 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "media-src 'self' https://*.supabase.co blob:",  // Permitir áudio do Supabase Storage e blob
          "connect-src 'self' ws://localhost:8084 ws://localhost:* ws://127.0.0.1:* wss: https: http://localhost:* http://127.0.0.1:* https://*.supabase.co https://api.openai.com https://connect.facebook.net https://*.facebook.net",
          "font-src 'self' data:",  // Fontes locais via @fontsource
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "child-src 'self' blob: data: https:",  // Permitir iframes e workers filhos
          "frame-src 'self' blob: data: https://connect.facebook.net https://*.facebook.net https://safeframe.googlesyndication.com",
        ].join('; ')
      } : undefined
    },
    plugins: [
      command === "serve" && adminHtmlFallback(),
      react(),
      // ✅ OTIMIZAÇÃO CRÍTICA: Tornar CSS não bloqueante em produção
      isBuild && nonBlockingCSS(),
      // ✅ OTIMIZAÇÃO: Minificar HTML (inline CSS/JS, whitespace) - reduz ~15-25% no index.html
      isBuild && ViteMinifyPlugin({ collapseWhitespace: true, minifyCSS: true, minifyJS: true, removeComments: true }),
      // ✅ OTIMIZAÇÃO: Visualizar composição do bundle (gera stats.html)
      isBuild && visualizer({ filename: "stats.html", gzipSize: true, open: false }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2022",
      cssCodeSplit: true,
      // ✅ OTIMIZAÇÃO: modulePreload habilitado para download paralelo de chunks críticos (React, etc.)
      modulePreload: true,
      sourcemap: false,
      minify: isBuild ? 'esbuild' : false,
      chunkSizeWarningLimit: 600,
      // ✅ OTIMIZAÇÃO: Code splitting simplificado e eficiente
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          admin: path.resolve(__dirname, "admin.html"),
        },
        onwarn(warning, warn) {
          // Suprimir avisos de scripts externos e bibliotecas backend
          if (warning.code === 'UNRESOLVED_IMPORT' || 
              warning.message?.includes('pixel') ||
              warning.message?.includes('requests.js') ||
              warning.code === 'EMPTY_BUNDLE') {
            return;
          }
          warn(warning);
        },
        output: {
          manualChunks(id, api) {
            const normalizedId = id.replaceAll('\\', '/');
            void api;

            // ✅ OTIMIZAÇÃO CRÍTICA: Separar admin ANTES de qualquer outra verificação
            // Garantir que admin nunca seja incluído no bundle inicial
            if (
              normalizedId.includes('/src/pages/admin/') ||
              normalizedId.includes('/src/components/admin/') ||
              normalizedId.includes('/src/admin/')
            ) {
              return 'admin';
            }

            if (normalizedId.includes('/src/components/LazyComponent')) {
              return 'common';
            }

            if (normalizedId.includes('/src/utils/devLogger')) {
              return 'common';
            }

            if (normalizedId.includes('/src/integrations/supabase/')) {
              return 'supabase-client';
            }

            if (
              normalizedId.includes('vite/preload-helper') ||
              normalizedId.includes('vite/modulepreload-polyfill')
            ) {
              return 'vendor';
            }

            // ✅ OTIMIZAÇÃO: Agrupar libs de UI em um único chunk para reduzir overhead de requisições
            if (normalizedId.includes('/node_modules/@radix-ui/')) {
              return 'ui-libs';
            }

            if (normalizedId.includes('/node_modules/@tanstack/')) {
              return 'data-libs';
            }

            // ✅ OTIMIZAÇÃO: Agrupar React Core
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/') ||
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'react-vendor';
            }

            // ✅ OTIMIZAÇÃO: Separar vendors grandes específicos
            if (normalizedId.includes('/node_modules/recharts/')) {
              return 'recharts';
            }
            
            if (normalizedId.includes('/node_modules/lucide-react/')) {
              return 'icons';
            }

            if (normalizedId.includes('/node_modules/sonner/') || normalizedId.includes('/node_modules/vaul/')) {
              return 'ui-overlays';
            }

            // ✅ OTIMIZAÇÃO: Separar Supabase Vendor para lazy loading eficiente
            if (normalizedId.includes('/node_modules/@supabase/')) {
              return 'supabase-vendor';
            }

            // REMOVED catch-all vendor chunk to allow better splitting by Rollup
            // if (normalizedId.includes('/node_modules/')) {
            //   return 'vendor';
            // }

            if (normalizedId.includes('/src/lib/utils')) {
              return 'common';
            }

            if (normalizedId.includes('/src/hooks/use-mobile')) {
              return 'common';
            }

            if (normalizedId.includes('/src/utils/lazyWithRetry')) {
              return 'common';
            }

            if (normalizedId.includes('/src/utils/deviceDetection')) {
              return 'common';
            }

            if (normalizedId.includes('/src/components/Logo')) {
              return 'common';
            }

            if (normalizedId.includes('/src/contexts/')) {
              return 'common';
            }

            if (
              normalizedId.includes('/src/lib/queryClient') ||
              normalizedId.includes('/src/lib/cache/')
            ) {
              return 'cache';
            }

            if (
              normalizedId.includes('/src/hooks/useUtmParams') ||
              normalizedId.includes('/src/hooks/use-scroll-animations')
            ) {
              return 'tracking';
            }

            // ✅ OTIMIZAÇÃO: Separar componentes UI em chunks menores
            if (normalizedId.includes('/src/components/ui/')) {
              return 'ui';
            }

            // ✅ OTIMIZAÇÃO: QuizCheckoutModal e QuizCheckoutFlow em chunk próprio - carrega só ao clicar CTA
            if (
              normalizedId.includes('/src/components/QuizCheckoutModal') ||
              normalizedId.includes('/src/components/QuizCheckoutFlow') ||
              normalizedId.includes('/src/components/quiz/')
            ) {
              return 'QuizCheckoutModal';
            }

            // ✅ OTIMIZAÇÃO: Admin já foi separado acima (verificação movida para o início)

            // ✅ OTIMIZAÇÃO: Separar componentes públicos abaixo do fold
            if (
              normalizedId.includes('/src/components/HowItWorks') ||
              normalizedId.includes('/src/components/Testimonials') ||
              normalizedId.includes('/src/components/OccasionsGrid') ||
              normalizedId.includes('/src/components/WhatYouGet') ||
              normalizedId.includes('/src/components/FAQ') ||
              normalizedId.includes('/src/components/Footer')
            ) {
              return 'below-fold';
            }

            return undefined;
          },
        },
      },
      // ✅ OTIMIZAÇÃO: esbuild é mais rápido que terser e suficiente para minificação
      // Removido terser para simplificar e acelerar builds
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
        legalComments: 'none',
        // ✅ OTIMIZAÇÃO: Configurações avançadas de minificação
        minifyIdentifiers: isBuild,
        minifySyntax: isBuild,
        minifyWhitespace: isBuild,
        treeShaking: true,
      },
      // ✅ OTIMIZAÇÃO: Minificar CSS em produção (esbuild é mais rápido)
      cssMinify: isBuild,
      reportCompressedSize: true, // ✅ OTIMIZAÇÃO: Ver tamanhos gzipped e acompanhar meta <100kb
      // ✅ OTIMIZAÇÃO: Melhor tree-shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    // ✅ FASE 4: Optimize dependencies para evitar loops de HMR
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        'embla-carousel-react',
        // ✅ CORREÇÃO: Incluir todos os pacotes Radix UI para garantir que React esteja disponível
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-progress',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-dialog',
        '@radix-ui/react-accordion',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-avatar',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-context-menu',
        '@radix-ui/react-label',
        '@radix-ui/react-menubar',
        '@radix-ui/react-navigation-menu',
        '@radix-ui/react-popover',
        '@radix-ui/react-radio-group',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-select',
        '@radix-ui/react-separator',
        '@radix-ui/react-slider',
        '@radix-ui/react-slot',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toast',
        '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group',
        'buffer'
      ],
      // ✅ OTIMIZAÇÃO: Excluir react-dom.development em produção e Stripe
      exclude: [
        ...(mode === 'production' ? ['react-dom/development'] : []),
      ],
      // ✅ FASE 4: Forçar re-otimização apenas quando necessário
      force: false,
      // ✅ FASE 4: Especificar entradas para evitar recarregamentos desnecessários
      entries: [],
      // ✅ FASE 4: Especificar esbuild options para melhor controle
      esbuildOptions: {
        // Manter configurações padrão, mas garantir que não haja rebuilds desnecessários
      }
    },
  };
});
