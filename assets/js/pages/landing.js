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
        trackEvent(getTrackingPayload(link));

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
    if (prefersReducedMotion || !window.gsap) return;

    const { gsap } = window;
    if (window.ScrollTrigger) {
      gsap.registerPlugin(window.ScrollTrigger);
    }

    gsap.timeline({ defaults: { duration: 0.85, ease: 'power3.out' } })
      .from('[data-hero-item]', {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        clearProps: 'opacity,transform'
      })
      .from('.landing-marquee', {
        y: 20,
        opacity: 0,
        duration: 0.62,
        clearProps: 'opacity,transform'
      }, '-=0.38');

    gsap.utils.toArray('[data-animate-card]').forEach((card, index) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 86%'
        },
        y: 30,
        opacity: 0,
        duration: 0.72,
        delay: Math.min(index * 0.03, 0.15),
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
    });

    gsap.utils.toArray('[data-animate-block]').forEach((block) => {
      gsap.from(block, {
        scrollTrigger: {
          trigger: block,
          start: 'top 84%'
        },
        y: 26,
        opacity: 0,
        duration: 0.68,
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
          end: 'top+=240 top',
          scrub: true
        }
      });
    }

    const heroVisual = document.querySelector('.landing-hero__visual');
    const landingGlow = document.querySelector('.landing-glow');
    if (heroVisual && landingGlow) {
      heroVisual.addEventListener('pointermove', (event) => {
        const bounds = heroVisual.getBoundingClientRect();
        const xNorm = (event.clientX - bounds.left) / bounds.width - 0.5;
        const yNorm = (event.clientY - bounds.top) / bounds.height - 0.5;

        gsap.to(landingGlow, {
          x: xNorm * 28,
          y: yNorm * 24,
          duration: 0.42,
          overwrite: 'auto',
          ease: 'power2.out'
        });

        gsap.to(heroVisual, {
          rotateY: xNorm * 3.2,
          rotateX: yNorm * -2.8,
          transformPerspective: 950,
          transformOrigin: 'center',
          duration: 0.42,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });

      heroVisual.addEventListener('pointerleave', () => {
        gsap.to(heroVisual, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.55,
          ease: 'power2.out'
        });

        gsap.to(landingGlow, {
          x: 0,
          y: 0,
          duration: 0.55,
          ease: 'power2.out'
        });
      });

      if (window.ScrollTrigger) {
        gsap.to(heroVisual, {
          yPercent: -6,
          ease: 'none',
          scrollTrigger: {
            trigger: heroVisual,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
      }
    }

    gsap.to('.landing-bg-orb--one', {
      xPercent: 10,
      yPercent: 8,
      repeat: -1,
      yoyo: true,
      duration: 9.5,
      ease: 'sine.inOut'
    });

    gsap.to('.landing-bg-orb--two', {
      xPercent: -10,
      yPercent: -9,
      repeat: -1,
      yoyo: true,
      duration: 11.5,
      ease: 'sine.inOut'
    });
  }

  function bindMagneticButtons() {
    if (prefersReducedMotion || !window.gsap) return;

    const buttons = document.querySelectorAll('[data-magnetic]');
    buttons.forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const offsetX = event.clientX - rect.left - rect.width / 2;
        const offsetY = event.clientY - rect.top - rect.height / 2;

        window.gsap.to(button, {
          x: offsetX * 0.14,
          y: offsetY * 0.22,
          duration: 0.24,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });

      button.addEventListener('pointerleave', () => {
        window.gsap.to(button, {
          x: 0,
          y: 0,
          duration: 0.42,
          ease: 'elastic.out(1, 0.45)'
        });
      });
    });
  }

  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');

    if (!window.gsap || !window.ScrollTrigger || prefersReducedMotion) {
      counters.forEach((counter) => {
        const target = Number(counter.dataset.counter || 0);
        const suffix = counter.dataset.counterSuffix || '';
        counter.textContent = `${target}${suffix}`;
      });
      return;
    }

    counters.forEach((counter) => {
      const target = Number(counter.dataset.counter || 0);
      const state = { value: 0 };
      const suffix = counter.dataset.counterSuffix || '';

      window.gsap.to(state, {
        value: target,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: counter,
          start: 'top 88%',
          once: true
        },
        onUpdate: () => {
          counter.textContent = `${Math.round(state.value)}${suffix}`;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindCtaTracking();
    runGsapAnimations();
    bindMagneticButtons();
    initCounters();
  });
})();
