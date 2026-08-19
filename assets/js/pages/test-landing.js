(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = document.querySelector('.rv-hero__video');
  const header = document.querySelector('[data-header]');
  const reveals = [...document.querySelectorAll('[data-reveal]')];

  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  if (reduceMotion) {
    if (video) {
      video.pause();
      video.removeAttribute('autoplay');
    }
    reveals.forEach((node) => node.classList.add('is-visible'));
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });

    reveals.forEach((node) => observer.observe(node));
  } else {
    reveals.forEach((node) => node.classList.add('is-visible'));
  }

  const syncHeader = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 48);
  };
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
})();
