/**
 * Inicialização robusta do React com tratamento de erros e fallbacks.
 * Extraído de main.tsx para manter main.tsx enxuto.
 */
import { createRoot } from "react-dom/client";
import App from "../App.tsx";
import { scheduleOnFirstInteraction } from "./scheduleNonCriticalRender";
import { startTitleMarquee } from "./titleMarquee";

const isDev = import.meta.env.DEV;

function signalReactReady() {
  (window as Window & { __REACT_READY__?: boolean }).__REACT_READY__ = true;
  window.dispatchEvent(new Event("react-ready"));
  scheduleOnFirstInteraction(() => startTitleMarquee("Sua Música Fácil"), { timeoutMs: 3000 });
}

function renderErrorFallback(element: HTMLElement, message: string) {
  element.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>Erro ao carregar a aplicação</h1><p>${message}</p></div>`;
}

function tryRender(element: HTMLElement): boolean {
  try {
    const root = createRoot(element);
    root.render(<App />);
    signalReactReady();
    return true;
  } catch (renderError) {
    if (isDev) {
      console.error("❌ [Main] Erro ao renderizar React:", renderError);
    }
    return false;
  }
}

export function initializeReact(): void {
  try {
    let rootElement = document.getElementById("root");

    if (!rootElement) {
      if (isDev) {
        console.warn("⚠️ [Main] Elemento root não encontrado! Criando novo elemento...");
      }
      const newRoot = document.createElement("div");
      newRoot.id = "root";
      document.body.appendChild(newRoot);
      rootElement = newRoot;
    }

    if (tryRender(rootElement)) return;

    // Fallback: segunda tentativa
    if (tryRender(rootElement)) return;

    renderErrorFallback(rootElement, "Por favor, recarregue a página.");
  } catch (error) {
    if (isDev) {
      console.error("❌ [Main] Erro crítico na inicialização do React:", error);
    }
    setTimeout(() => {
      const fallbackRoot =
        document.getElementById("root") ??
        (() => {
          const el = document.createElement("div");
          el.id = "root";
          document.body.appendChild(el);
          return el;
        })();
      if (!tryRender(fallbackRoot)) {
        if (isDev) {
          console.error("❌ [Main] Falha total na inicialização do React");
        }
      }
    }, 1000);
  }
}
