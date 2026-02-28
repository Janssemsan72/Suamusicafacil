import { safeTrackCheckout } from './pixelTracking';

/**
 * Listener global (capture phase) que detecta cliques em elementos
 * marcados com data-cta="checkout" e dispara fbq InitiateCheckout (Meta Pixel).
 */
export function initCheckoutClickListener(): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cta="checkout"]');
      if (!target) return;

      const ctaId = target.getAttribute('data-cta-id') || '';
      safeTrackCheckout({ content_name: ctaId, value: 37.00, currency: 'BRL' });
    },
    true,
  );
}
