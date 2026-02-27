/**
 * Listener global (capture phase) que detecta cliques em elementos
 * marcados com data-cta="checkout" e dispara dataLayer.push automaticamente.
 *
 * Funciona tanto para <a href> nativos quanto para <button> com redirect async.
 */
export function initCheckoutClickListener(): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cta="checkout"]');
      if (!target) return;

      const ctaId = target.getAttribute('data-cta-id') || '';
      const href = target.getAttribute('href') || '';

      const w = window as unknown as { dataLayer: Record<string, unknown>[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: 'begin_checkout',
        cta_id: ctaId,
        click_url: href,
      });
    },
    true,
  );
}
