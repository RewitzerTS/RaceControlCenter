(() => {
  'use strict';

  const scriptElement = document.currentScript
    || document.querySelector('script[src*="test-landing/script.js"],script[src*="script.js"]');
  const ASSET_ROOT = scriptElement?.src
    ? new URL('.', scriptElement.src).href.replace(/\/$/, '')
    : '.';
  const ASSET_VERSION = 'phase24-2026-08-20';
  const FRAME_COUNT = 90;
  const FRAME_WINDOW_RADIUS = 3;
  const story = document.querySelector('.cinematic-story');
  const canvas = story?.querySelector('canvas');
  const mobileVideo = story?.querySelector('.mobile-master');
  const mobileSource = mobileVideo?.querySelector('source[data-src]');
  const motionPoster = story?.querySelector('.motion-poster[data-src]');
  const chapters = [...(story?.querySelectorAll('.story-chapters article') || [])];
  const rails = [...(story?.querySelectorAll('.story-rail i') || [])];
  const header = document.querySelector('[data-header]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px)');
  const images = new Map();
  let activeChapter = 0;
  let desiredFrame = 0;
  let lastFrame = -1;
  let started = false;
  let loadingQueued = false;
  let raf = 0;

  const frameSrc = (index) => `${ASSET_ROOT}/frames/frame-${String(index).padStart(3, '0')}.webp?v=${ASSET_VERSION}`;

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
    if (index < 0 || index >= FRAME_COUNT || images.has(index)) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = frameSrc(index);
    image.onload = () => {
      if (index === 0) story?.classList.add('is-ready');
      if (index === desiredFrame || (lastFrame < 0 && index === 0)) draw(index);
    };
    images.set(index, image);
  }

  function loadFrameWindow(center, radius = FRAME_WINDOW_RADIUS) {
    loadFrame(center);
    for (let gap = 1; gap <= radius; gap += 1) {
      loadFrame(center - gap);
      loadFrame(center + gap);
    }
  }

  function activateMotionPoster() {
    if (!motionPoster?.dataset.src) return;
    motionPoster.src = motionPoster.dataset.src;
    delete motionPoster.dataset.src;
  }

  function activateMobileVideo() {
    if (!mobile.matches || reduceMotion.matches || !mobileVideo || !mobileSource?.dataset.src) return;
    if (mobileVideo.dataset.poster) {
      mobileVideo.poster = mobileVideo.dataset.poster;
      delete mobileVideo.dataset.poster;
    }
    mobileSource.src = mobileSource.dataset.src;
    delete mobileSource.dataset.src;
    mobileVideo.load();
    mobileVideo.play().catch(() => {});
  }

  function beginLoading() {
    if (started || mobile.matches || reduceMotion.matches) return;
    started = true;
    loadFrameWindow(0);
  }

  function queueDesktopLoading() {
    if (started || loadingQueued || mobile.matches || reduceMotion.matches) return;
    if (document.readyState === 'complete') {
      beginLoading();
      return;
    }
    loadingQueued = true;
    window.addEventListener('load', () => {
      loadingQueued = false;
      beginLoading();
      requestUpdate();
    }, { once: true });
  }

  function update() {
    raf = 0;
    header?.classList.toggle('is-scrolled', window.scrollY > 48);
    if (!story || reduceMotion.matches) return;
    const isMobile = mobile.matches;
    if (isMobile) activateMobileVideo();
    const rect = story.getBoundingClientRect();
    const distance = Math.max(1, story.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / distance));
    story.style.setProperty('--story-progress', String(progress));
    setChapter(Math.min(2, Math.floor(progress * 3)));
    if (isMobile) return;
    const frame = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
    desiredFrame = frame;
    if (started) {
      loadFrameWindow(frame);
      if (frame !== lastFrame && !draw(frame)) {
        for (let gap = 1; gap <= FRAME_WINDOW_RADIUS + 1; gap += 1) {
          if (draw(Math.max(0, frame - gap)) || draw(Math.min(FRAME_COUNT - 1, frame + gap))) break;
        }
      }
    }
  }

  function requestUpdate() {
    if (!raf) raf = window.requestAnimationFrame(update);
  }

  if (story && canvas) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (mobile.matches) activateMobileVideo();
      else queueDesktopLoading();
    }, { rootMargin: '50% 0px' });
    observer.observe(story);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => { lastFrame = -1; requestUpdate(); }, { passive: true });
  reduceMotion.addEventListener?.('change', () => window.location.reload());
  mobile.addEventListener?.('change', () => window.location.reload());
  if (reduceMotion.matches) activateMotionPoster();
  else if (mobile.matches) activateMobileVideo();
  else queueDesktopLoading();
  update();
})();
