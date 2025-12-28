// Preloader utility for optimizing initial page load
export const initializePreloader = () => {
  // Remove preloader if it exists
  const preloader = document.getElementById('preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.style.opacity = '0';
      setTimeout(() => preloader.remove(), 300);
    }, 500);
  }
};

export default { initializePreloader };
