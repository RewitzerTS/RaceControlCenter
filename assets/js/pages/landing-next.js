(() => {
  'use strict';
  if (document.body?.dataset?.page !== 'landing-next') return;

  const responsiveHref = 'assets/css/pages/landing-next-responsive.css';
  if (!document.querySelector(`link[href="${responsiveHref}"]`)) {
    const responsive = document.createElement('link');
    responsive.rel = 'stylesheet';
    responsive.href = responsiveHref;
    document.head.appendChild(responsive);
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  revealTargets.forEach((node) => node.classList.add('rvx-reveal'));

  if (reduced.matches || !('IntersectionObserver' in window)) {
    revealTargets.forEach((node) => node.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach((node) => observer.observe(node));
  }

  document.querySelectorAll('iframe[data-product-preview]').forEach((frame) => {
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    frame.loading = frame.closest('.rvx-hero') ? 'eager' : 'lazy';
  });
})();
