import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import type { AppRole } from '../roles/roleMapping';
import { availableTutorials, defaultTutorial, tutorialStorageKey, type TutorialId, type TutorialTrack } from './tutorials';
import './tutorials.css';

type HighlightRect = { height: number; left: number; top: number; width: number };

function readStored(key: string): boolean {
  try { return globalThis.localStorage?.getItem(key) === 'true'; } catch { return false; }
}

function writeStored(key: string) {
  try { globalThis.localStorage?.setItem(key, 'true'); } catch { /* The choice still applies for this session. */ }
}

function routeMatches(currentPath: string, target: string): boolean {
  const [pathname] = target.split('?');
  return currentPath === pathname;
}

export function TutorialCenter({
  autoOpen = false,
  obscured = false,
  onVisibilityChange,
  role,
  userId,
}: {
  autoOpen?: boolean;
  obscured?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  role: AppRole | null;
  userId: string;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [centerOpen, setCenterOpen] = useState(false);
  const [activeId, setActiveId] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [completionRevision, setCompletionRevision] = useState(0);
  const tracks = useMemo(() => {
    const available = availableTutorials(role);
    const primary = defaultTutorial(role);
    return [primary, ...available.filter((track) => track.id !== primary.id)];
  }, [role]);
  const activeTrack = activeId ? tracks.find((track) => track.id === activeId) ?? null : null;
  const activeStep = activeTrack?.steps[stepIndex] ?? null;
  const visible = centerOpen || Boolean(activeTrack);

  useEffect(() => {
    onVisibilityChange?.(visible);
    return () => onVisibilityChange?.(false);
  }, [onVisibilityChange, visible]);

  useEffect(() => {
    if (!autoOpen || readStored(tutorialStorageKey(userId, 'intro'))) return;
    writeStored(tutorialStorageKey(userId, 'intro'));
    setCenterOpen(true);
  }, [autoOpen, userId]);

  useEffect(() => {
    if (!centerOpen) return;
    closeRef.current?.focus();
  }, [centerOpen]);

  useEffect(() => {
    if (!activeStep || routeMatches(location.pathname, activeStep.path)) return;
    navigate(activeStep.path);
  }, [activeStep, location.pathname, navigate]);

  useEffect(() => {
    if (!activeStep || !routeMatches(location.pathname, activeStep.path)) {
      setHighlight(null);
      return;
    }

    let frame = 0;
    let scrollFrame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(activeStep.selector) ?? document.querySelector<HTMLElement>('#main-content');
        if (!target) { setHighlight(null); return; }
        const rect = target.getBoundingClientRect();
        const inset = 8;
        const left = Math.max(8, rect.left - inset);
        const top = Math.max(8, rect.top - inset);
        setHighlight({
          left,
          top,
          width: Math.max(0, Math.min(window.innerWidth - left - 8, rect.width + inset * 2)),
          height: Math.max(0, Math.min(window.innerHeight - top - 8, rect.height + inset * 2)),
        });
      });
    };
    const target = document.querySelector<HTMLElement>(activeStep.selector);
    if (target) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      scrollFrame = requestAnimationFrame(update);
    } else update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [activeStep, location.pathname]);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeTrack) endTour();
      else closeCenter();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  function closeCenter() {
    setCenterOpen(false);
    triggerRef.current?.focus();
  }

  function startTour(track: TutorialTrack) {
    writeStored(tutorialStorageKey(userId, 'intro'));
    setCenterOpen(false);
    setFinished(false);
    setStepIndex(0);
    setActiveId(track.id);
  }

  function endTour() {
    setActiveId(null);
    setFinished(false);
    setStepIndex(0);
    setHighlight(null);
    triggerRef.current?.focus();
  }

  function nextStep() {
    if (!activeTrack) return;
    if (stepIndex < activeTrack.steps.length - 1) {
      setStepIndex((value) => value + 1);
      return;
    }
    writeStored(tutorialStorageKey(userId, activeTrack.id));
    setCompletionRevision((value) => value + 1);
    setFinished(true);
    setHighlight(null);
  }

  const highlightStyle = highlight ? {
    '--tutorial-height': `${highlight.height}px`,
    '--tutorial-left': `${highlight.left}px`,
    '--tutorial-top': `${highlight.top}px`,
    '--tutorial-width': `${highlight.width}px`,
  } as CSSProperties : undefined;

  return <>
    <button
      aria-controls="tutorial-center"
      aria-expanded={visible}
      aria-label={t('tutorial.open')}
      className="tutorial-trigger"
      hidden={obscured || visible}
      onClick={() => {
        writeStored(tutorialStorageKey(userId, 'intro'));
        setCenterOpen(true);
      }}
      ref={triggerRef}
      title={t('tutorial.open')}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.5 2c-.9.5-1.3 1.1-1.3 2" /><path d="M12 17h.01" /></svg>
    </button>

    {centerOpen && <aside aria-describedby="tutorial-center-copy" aria-labelledby="tutorial-center-title" className="tutorial-center" id="tutorial-center" role="dialog">
      <header className="tutorial-heading">
        <h2 id="tutorial-center-title">{t('tutorial.center.title')}</h2>
        <button aria-label={t('tutorial.close')} className="tutorial-close" onClick={closeCenter} ref={closeRef} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
      </header>
      <p id="tutorial-center-copy">{t('tutorial.center.copy')}</p>
      <div className="tutorial-track-list">
        {tracks.map((track) => {
          const complete = readStored(tutorialStorageKey(userId, track.id));
          return <article className="tutorial-track" key={`${track.id}-${completionRevision}`}>
            <div><h3>{t(track.titleKey)}</h3><p>{t(track.copyKey)}</p><small>{t('tutorial.duration', { minutes: track.minutes })} · {t('tutorial.steps', { count: track.steps.length })}</small></div>
            <button onClick={() => startTour(track)} type="button">{complete ? t('tutorial.restart') : t('tutorial.start')}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></button>
            {complete && <span className="tutorial-complete">{t('tutorial.completed')}</span>}
          </article>;
        })}
      </div>
    </aside>}

    {activeTrack && <>
      {highlight && !finished && <div aria-hidden="true" className="tutorial-spotlight" style={highlightStyle} />}
      <section aria-atomic="true" aria-live="polite" className="tutorial-coach" role="dialog">
        {finished ? <>
          <div className="tutorial-finish-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg></div>
          <h2>{t('tutorial.done.title')}</h2>
          <p>{t('tutorial.done.copy')}</p>
          <button className="tutorial-primary" onClick={endTour} type="button">{t('tutorial.done.action')}</button>
        </> : activeStep && <>
          <div className="tutorial-coach-progress"><span>{t(activeTrack.titleKey)}</span><strong>{t('tutorial.progress', { step: stepIndex + 1, count: activeTrack.steps.length })}</strong></div>
          <div aria-hidden="true" className="tutorial-progress-track"><span style={{ transform: `scaleX(${(stepIndex + 1) / activeTrack.steps.length})` }} /></div>
          <h2>{t(activeStep.titleKey)}</h2>
          <p>{t(activeStep.copyKey)}</p>
          <div className="tutorial-actions">
            <button className="tutorial-quiet" onClick={endTour} type="button">{t('tutorial.skip')}</button>
            <div>
              {stepIndex > 0 && <button className="tutorial-back" onClick={() => setStepIndex((value) => value - 1)} type="button">{t('tutorial.back')}</button>}
              <button className="tutorial-primary" onClick={nextStep} type="button">{stepIndex === activeTrack.steps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg></button>
            </div>
          </div>
        </>}
      </section>
    </>}
  </>;
}
