(function initLandingPage() {
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = reduceMotionQuery.matches;

  function getTrackingPayload(target) {
    return {
      event: target.dataset.trackEvent,
      target: target.dataset.trackTarget || '',
      location: 'landing',
      timestamp: new Date().toISOString()
    };
  }

  function trackEvent(payload) {
    // Zentraler Tracking Helper (kompatibel mit dataLayer + Custom Listenern).
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
    document.dispatchEvent(new CustomEvent('rcc:tracking', { detail: payload }));
    console.info('[RCC Tracking]', payload.event, payload);
  }

  function appendPreservedUtms(rawHref) {
    const href = rawHref || '';
    if (!href || href.startsWith('#')) return href;

    const current = new URL(window.location.href);
    const destination = new URL(href, window.location.origin);
    current.searchParams.forEach((value, key) => {
      if (key.startsWith('utm_') || key === 'gclid' || key === 'fbclid') {
        if (!destination.searchParams.has(key)) {
          destination.searchParams.set(key, value);
        }
      }
    });

    return `${destination.pathname}${destination.search}${destination.hash}`;
  }

  function bindCtaTracking() {
    const ctaLinks = document.querySelectorAll('[data-track-event]');

    ctaLinks.forEach((link) => {
      if (link.dataset.bound === 'true') return;

      link.addEventListener('click', (event) => {
        const payload = getTrackingPayload(link);
        trackEvent(payload);

        if (link.dataset.ctaSecondary !== undefined) {
          event.preventDefault();
          const targetSection = document.querySelector(link.getAttribute('href'));
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
          }
          return;
        }

        const nextHref = appendPreservedUtms(link.getAttribute('href'));
        if (nextHref) {
          link.setAttribute('href', nextHref);
        }
      });

      link.dataset.bound = 'true';
    });
  }

  function runGsapAnimations() {
    if (prefersReducedMotion || !window.gsap) {
      return;
    }

    const { gsap } = window;
    if (window.ScrollTrigger) {
      gsap.registerPlugin(window.ScrollTrigger);
    }

    gsap.timeline({ defaults: { duration: 0.8, ease: 'power3.out' } })
      .from('[data-hero-item]', {
        y: 30,
        opacity: 0,
        stagger: 0.13,
        clearProps: 'opacity,transform'
      });

    gsap.from('[data-animate-card]', {
      scrollTrigger: {
        trigger: '#key-facts',
        start: 'top 74%'
      },
      y: 28,
      opacity: 0,
      duration: 0.7,
      ease: 'power2.out',
      stagger: 0.14,
      clearProps: 'opacity,transform'
    });

    gsap.utils.toArray('[data-animate-block]').forEach((block) => {
      gsap.from(block, {
        scrollTrigger: {
          trigger: block,
          start: 'top 82%'
        },
        y: 24,
        opacity: 0,
        duration: 0.65,
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
    });


    const landingLogo = document.querySelector('.landing-logo-anchor');
    if (landingLogo && window.ScrollTrigger) {
      gsap.to(landingLogo, {
        y: -130,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.landing-main',
          start: 'top top',
          end: 'top+=220 top',
          scrub: true
        }
      });
    }

    const heroVisual = document.querySelector('.landing-hero__visual');
    if (heroVisual) {
      heroVisual.addEventListener('pointermove', (event) => {
        const bounds = heroVisual.getBoundingClientRect();
        const xNorm = (event.clientX - bounds.left) / bounds.width - 0.5;
        const yNorm = (event.clientY - bounds.top) / bounds.height - 0.5;

        gsap.to('.landing-glow', {
          x: xNorm * 20,
          y: yNorm * 18,
          duration: 0.45,
          overwrite: 'auto',
          ease: 'power2.out'
        });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindCtaTracking();
    runGsapAnimations();
  });
})();
