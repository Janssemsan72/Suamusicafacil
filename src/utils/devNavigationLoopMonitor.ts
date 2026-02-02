export function setupDevNavigationLoopMonitor() {
  let lastReloadTime = 0;
  let reloadCount = 0;
  const maxReloadsPerMinute = 3;
  const reloadCooldownMs = 20000;

  let lastHrefChange = 0;
  let hrefChangeCount = 0;
  const maxHrefChangesPerSecond = 10;
  const hrefChangeCooldownMs = 1000;

  const checkHrefChange = () => {
    const now = Date.now();
    const timeSinceLastChange = now - lastHrefChange;

    if (timeSinceLastChange < hrefChangeCooldownMs && lastHrefChange > 0) {
      hrefChangeCount++;
      if (hrefChangeCount >= maxHrefChangesPerSecond) {
        console.error("❌ [Main] POSSÍVEL LOOP DE NAVEGAÇÃO DETECTADO!");
      }
    } else {
      hrefChangeCount = 0;
    }

    lastHrefChange = now;
  };

  window.addEventListener("beforeunload", () => {
    const now = Date.now();
    const timeSinceLastReload = now - lastReloadTime;

    if (timeSinceLastReload < reloadCooldownMs && lastReloadTime > 0) {
      reloadCount++;
      if (reloadCount >= maxReloadsPerMinute) {
        console.error("❌ [Main] POSSÍVEL LOOP DE RECARREGAMENTO DETECTADO!");
      }
    } else {
      reloadCount = 0;
    }

    lastReloadTime = now;
  });

  window.addEventListener("popstate", checkHrefChange);
  window.addEventListener("hashchange", checkHrefChange);
}

