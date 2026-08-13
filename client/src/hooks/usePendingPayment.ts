import { useEffect, useRef } from 'react';

/**
 * Calls `confirm` on an interval while `enabled` is true. Used after a NaloPay
 * prompt so the page can pick up collection-status without a public webhook.
 * `confirm` should return true when payment is done (so the interval can stop
 * as soon as the parent clears `enabled`).
 */
export function usePendingPayment(
  enabled: boolean,
  confirm: () => Promise<boolean>,
  intervalMs = 4000,
): void {
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tick = () => {
      void confirmRef.current().then((done) => {
        if (cancelled || !done) return;
        window.clearInterval(id);
      });
    };

    tick();
    const id = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);
}
