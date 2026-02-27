import { safeTrackCheckout } from './pixelTracking';

/**
 * Listener global (capture phase) que detecta cliques em elementos
 * marcados com data-cta="checkout" e dispara dataLayer.push (GTM)
 * e fbq InitiateCheckout (Meta Pixel) automaticamente.
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

      safeTrackCheckout({ content_name: ctaId, value: 37.00, currency: 'BRL' });
    },
    true,
  );
}
