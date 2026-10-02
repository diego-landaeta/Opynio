// Performance monitoring utilities
export const initWebVitalsMonitoring = () => {
  // Web Vitals monitoring (optional - can be expanded)
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Log performance metrics
    // Dentro del propio 'load', loadEventEnd aun vale 0 y salia un tiempo
    // negativo. Se mide en el siguiente tick y solo en desarrollo.
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav && nav.loadEventEnd > 0 && import.meta.env.DEV) {
          console.log(`Page load time: ${Math.round(nav.loadEventEnd)}ms`);
        }
      }, 0);
    });
  }
};

export const optimizeResourceLoading = () => {
  // Optimize resource loading (optional - can be expanded)
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection && connection.effectiveType) {
      console.log(`Connection type: ${connection.effectiveType}`);
    }
  }
};

export default {
  initWebVitalsMonitoring,
  optimizeResourceLoading,
};
