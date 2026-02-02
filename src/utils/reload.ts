export type SafeReloadOptions = {
  reason?: string;
  cooldownMs?: number;
  maxPerWindow?: number;
};

export function safeReload(options: SafeReloadOptions = {}): void {
  const { reason, cooldownMs = 60000, maxPerWindow = 1 } = options;
  try {
    const lastKey = "app_last_reload_time";
    const countKey = "app_reload_count";
    const now = Date.now();
    const last = Number(sessionStorage.getItem(lastKey)) || 0;
    const count = Number(sessionStorage.getItem(countKey)) || 0;
    const since = now - last;
    if (since < cooldownMs && count >= maxPerWindow) {
      return;
    }
    sessionStorage.setItem(lastKey, String(now));
    sessionStorage.setItem(countKey, String(count + 1));
    if (reason) {
      console.log("[safeReload]", { reason, since, count: count + 1 });
    }
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

