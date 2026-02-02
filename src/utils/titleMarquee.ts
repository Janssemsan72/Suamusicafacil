/**
 * Efeito letreiro no título da aba do navegador.
 * Rotaciona os caracteres do título para simular rolagem.
 * Pausa quando a aba está em background (Page Visibility API).
 * Respeita prefers-reduced-motion para acessibilidade.
 */

const DEFAULT_INTERVAL_MS = 450;
const SEPARATOR = ' ♪ ';

function rotateTitle(title: string): string {
  if (title.length <= 1) return title;
  return title.slice(1) + title[0];
}

/**
 * Inicia o efeito letreiro no título da aba.
 * @param baseTitle - Texto base para rotação (ex: "Sua Música Fácil")
 * @param intervalMs - Intervalo entre frames em ms (default: 450)
 * @returns Função de cleanup para parar o letreiro
 */
export function startTitleMarquee(
  baseTitle: string,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  if (typeof document === 'undefined') return () => {};

  // Respeitar preferência de movimento reduzido
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return () => {};

  let title = baseTitle + SEPARATOR;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isPaused = false;

  const tick = () => {
    if (isPaused) return;
    title = rotateTitle(title);
    document.title = title;
  };

  const start = () => {
    if (intervalId) return;
    document.title = title;
    intervalId = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      isPaused = true;
      stop();
    } else {
      isPaused = false;
      start();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.title = baseTitle;
  };
}
