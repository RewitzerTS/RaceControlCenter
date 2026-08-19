(() => {
  'use strict';

  const scriptElement = document.querySelector('script[src$="test-landing/script.js"],script[src$="script.js"]');
  const ASSET_ROOT = scriptElement?.src
    ? new URL('.', scriptElement.src).href.replace(/\/$/, '')
    : '.';
  const FRAME_COUNT = 90;
  const story = document.querySelector('.cinematic-story');
  const canvas = story?.querySelector('canvas');
  const chapters = [...(story?.querySelectorAll('.story-chapters article') || [])];
  const rails = [...(story?.querySelectorAll('.story-rail i') || [])];
  const header = document.querySelector('[data-header]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px)');
  const images = new Map();
  let activeChapter = 0;
  let lastFrame = -1;
  let started = false;
  let raf = 0;

  const frameSrc = (index) => `${ASSET_ROOT}/frames/frame-${String(index).padStart(3, '0')}.webp`;

  function setChapter(index) {
    if (index === activeChapter) return;
    activeChapter = index;
    chapters.forEach((chapter, chapterIndex) => {
      const isActive = chapterIndex === index;
      chapter.classList.toggle('active', isActive);
      chapter.setAttribute('aria-hidden', String(!isActive));
    });
    rails.forEach((rail, railIndex) => rail.classList.toggle('active', railIndex === index));
  }

  function draw(index) {
    if (!canvas || mobile.matches || reduceMotion.matches) return false;
    const image = images.get(index);
    if (!image?.complete || !image.naturalWidth) return false;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    lastFrame = index;
    return true;
  }

  function loadFrame(index) {
    if (images.has(index)) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = frameSrc(index);
    image.onload = () => {
      if (index === 0) {
        draw(0);
        story?.classList.add('is-ready');
      }
    };
    images.set(index, image);
  }

  function beginLoading() {
    if (started || mobile.matches || reduceMotion.matches) return;
    started = true;
    loadFrame(0);
    let index = 1;
    const batch = () => {
      for (let count = 0; count < 6 && index < FRAME_COUNT; count += 1, index += 1) loadFrame(index);
      if (index < FRAME_COUNT) window.setTimeout(batch, 80);
    };
    batch();
  }

  function update() {
    raf = 0;
    header?.classList.toggle('is-scrolled', window.scrollY > 48);
    if (!story || reduceMotion.matches) return;
    const rect = story.getBoundingClientRect();
    const distance = Math.max(1, story.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / distance));
    const frame = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
    story.style.setProperty('--story-progress', String(progress));
    setChapter(Math.min(2, Math.floor(progress * 3)));
    if (frame !== lastFrame && !draw(frame)) {
      for (let gap = 1; gap <= 4; gap += 1) {
        if (draw(Math.max(0, frame - gap))) break;
      }
    }
  }

  function requestUpdate() {
    if (!raf) raf = window.requestAnimationFrame(update);
  }

  if (story && canvas) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) beginLoading();
    }, { rootMargin: '100% 0px' });
    observer.observe(story);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => { lastFrame = -1; requestUpdate(); }, { passive: true });
  reduceMotion.addEventListener?.('change', () => window.location.reload());
  mobile.addEventListener?.('change', () => window.location.reload());
  beginLoading();
  update();
})();
