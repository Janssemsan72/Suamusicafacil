import { logoAssetUrl } from "./logoAsset";

/**
 * Performance optimization utilities
 */

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      window.setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Debounce function to delay execution until after delay
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Request Animation Frame throttle for scroll events
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    }
  };
}

/**
 * Intersection Observer for lazy loading
 */
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private marks: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    const end = performance.now();
    
    if (start) {
      const duration = end - start;
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
      return duration;
    }
    
    return 0;
  }

  clear(): void {
    this.marks.clear();
  }
}

/**
 * Memory usage monitoring
 */
interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

export function getMemoryUsage(): MemoryInfo | null {
  if ('memory' in performance) {
    return (performance as any).memory;
  }
  return null;
}

/**
 * Bundle size optimization helpers
 */
export const bundleOptimizations = {
  // Tree shaking helpers
  unusedExports: [
    'unusedFunction',
    'unusedComponent'
  ],
  
  // Dynamic imports for code splitting
  dynamicImports: {
    admin: () => import('../pages/admin/AdminLayout'),
    charts: () => import('recharts'),
    // ✅ OTIMIZAÇÃO: Removido dateUtils - date-fns já é importado de forma otimizada nos componentes
  }
};

/**
 * Preload critical resources
 */
export function preloadCriticalResources(): void {
  // Preload critical fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.href = '/fonts/inter.woff2';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);

  // Preload critical images
  const imageLink = document.createElement('link');
  imageLink.rel = 'preload';
  imageLink.href = logoAssetUrl;
  imageLink.as = 'image';
  imageLink.type = 'image/png';
  document.head.appendChild(imageLink);
}

/**
 * Service Worker registration for caching
 */
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}
