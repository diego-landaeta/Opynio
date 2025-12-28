// Performance monitoring utilities
export const initWebVitalsMonitoring = () => {
  // Web Vitals monitoring (optional - can be expanded)
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Log performance metrics
    window.addEventListener('load', () => {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      console.log(`Page load time: ${pageLoadTime}ms`);
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
