export type ScheduleNonCriticalRenderOptions = {
  timeoutMs?: number;
  delayMs?: number;
};

export type ScheduleOnFirstInteractionOptions = {
  events?: Array<keyof DocumentEventMap>;
  timeoutMs?: number;
  includeWindowScroll?: boolean;
};

export function scheduleNonCriticalRender(
  fn: () => void,
  options: ScheduleNonCriticalRenderOptions = {}
): () => void {
  const timeoutMs = options.timeoutMs ?? 2500;
  const delayMs = options.delayMs ?? 500;

  if (typeof window === "undefined") {
    fn();
    return () => {};
  }

  const requestIdleCallbackFn = (window as any).requestIdleCallback as
    | ((cb: () => void, options?: { timeout: number }) => number)
    | undefined;
  const cancelIdleCallbackFn = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;

  if (typeof requestIdleCallbackFn === "function") {
    const id = requestIdleCallbackFn(fn, { timeout: timeoutMs });
    return () => {
      if (typeof cancelIdleCallbackFn === "function") {
        cancelIdleCallbackFn(id);
      }
    };
  }

  const id = setTimeout(fn, delayMs);
  return () => clearTimeout(id);
}

export function scheduleOnFirstInteraction(
  fn: () => void,
  options: ScheduleOnFirstInteractionOptions = {}
): () => void {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }

  const events: Array<keyof DocumentEventMap> = options.events ?? [
    "mousedown",
    "touchstart",
    "keydown",
    "scroll",
  ];
  const includeWindowScroll = options.includeWindowScroll ?? true;

  let hasRun = false;
  let timeoutId: number | null = null;

  let cleanup = () => {};

  const run = () => {
    if (hasRun) return;
    hasRun = true;
    cleanup();
    fn();
  };

  const listenerOptions: AddEventListenerOptions = { once: true, passive: true };

  const removeFns: Array<() => void> = [];
  for (const eventName of events) {
    document.addEventListener(eventName, run, listenerOptions);
    removeFns.push(() => document.removeEventListener(eventName, run, listenerOptions));
  }

  if (includeWindowScroll) {
    window.addEventListener("scroll", run, listenerOptions);
    removeFns.push(() => window.removeEventListener("scroll", run, listenerOptions));
  }

  if (typeof options.timeoutMs === "number") {
    timeoutId = window.setTimeout(run, options.timeoutMs);
  }

  cleanup = () => {
    for (const remove of removeFns) remove();
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };

  return cleanup;
}

export type ScheduleOnIdleOrInteractionOptions = {
  idleTimeoutMs?: number;
  delayMs?: number;
  interactionTimeoutMs?: number;
  interactionEvents?: Array<keyof DocumentEventMap>;
  includeWindowScroll?: boolean;
};

export function scheduleOnIdleOrInteraction(
  fn: () => void,
  options: ScheduleOnIdleOrInteractionOptions = {}
): () => void {
  if (typeof window === "undefined") {
    fn();
    return () => {};
  }

  let hasRun = false;
  let cancelIdle: (() => void) | null = null;
  let cancelInteraction: (() => void) | null = null;

  const run = () => {
    if (hasRun) return;
    hasRun = true;
    cancelIdle?.();
    cancelInteraction?.();
    fn();
  };

  cancelIdle = scheduleNonCriticalRender(run, {
    timeoutMs: options.idleTimeoutMs,
    delayMs: options.delayMs,
  });

  cancelInteraction = scheduleOnFirstInteraction(run, {
    events: options.interactionEvents,
    timeoutMs: options.interactionTimeoutMs,
    includeWindowScroll: options.includeWindowScroll,
  });

  return () => {
    if (hasRun) return;
    hasRun = true;
    cancelIdle?.();
    cancelInteraction?.();
  };
}
