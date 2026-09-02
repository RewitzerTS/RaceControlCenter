import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useRole } from '../roles/RoleProvider';
import { downloadGraphicFiles } from './downloadGraphics';
import { canShareInstagram, clamp, INSTAGRAM_FORMATS, instagramPng, loadInstagramAssets, MAX_INSTAGRAM_BLOCKS,
  newInstagramBlock, paintInstagram, shareInstagram, updateInstagramBlock,
  type InstagramBlock, type InstagramBlockLayout, type InstagramDocument, type InstagramFormat, type InstagramTextStyle } from './instagram';
import './instagram.css';

export function InstagramStudioPage() {
  const { role } = useRole();
  const { t } = useI18n();
  if (role !== 'platform_owner') return <AppState title={t('owner.denied')} copy={t('owner.copy')} tone="denied" />;
  return <InstagramEditor />;
}

export function InstagramEditor() {
  const { t } = useI18n();
  const [format, setFormat] = useState<InstagramFormat>('feed');
  const [documents, setDocuments] = useState<Record<InstagramFormat, InstagramDocument>>(() => ({
    feed: { format: 'feed', blocks: [newInstagramBlock('h1', 0)] },
    story: { format: 'story', blocks: [newInstagramBlock('h1', 0)] },
  }));
  const doc = documents[format];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = doc.blocks.find((block) => block.id === selectedId) ?? doc.blocks[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number; height: number } | null>(null);
  const history = useRef<Record<InstagramFormat, InstagramDocument[]>>({ feed: [], story: [] });
  const [ready, setReady] = useState<{ doc: InstagramDocument; file: File } | null>(null);
  const [layouts, setLayouts] = useState<InstagramBlockLayout[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [feedback, setFeedback] = useState<MessageKey | null>(null);
  const [sharing, setSharing] = useState(false);
  const dimensions = INSTAGRAM_FORMATS[format];
  const overflow = layouts.some((layout) => layout.overflow);
  const currentFile = ready?.doc === doc && !error && !overflow ? ready.file : null;
  const hasText = doc.blocks.some((block) => block.text.trim());
  const canExport = Boolean(currentFile && hasText);
  const shareSupported = Boolean(currentFile && canShareInstagram(currentFile));

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setError(false);
    setFeedback(null);
    void loadInstagramAssets(doc.format).then(([, background]) => {
      if (!active || !canvasRef.current) return;
      const nextLayouts = paintInstagram(canvasRef.current, doc, background);
      setLayouts(nextLayouts);
      if (nextLayouts.some((layout) => layout.overflow)) { setReady(null); return; }
      // Prepare the actual PNG before Share is enabled, preserving click activation.
      timer = setTimeout(() => {
        if (!active || !canvasRef.current) return;
        void instagramPng(canvasRef.current).then((blob) => {
          if (!active) return;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `racevora-instagram-${doc.format}-${timestamp}.png`, { type: 'image/png' });
          setReady({ doc, file });
        }).catch(() => { if (active) setError(true); });
      }, 150);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; clearTimeout(timer); };
  }, [doc, retry]);

  useEffect(() => {
    if (!Object.values(documents).some((document) => document.blocks.some((block) => block.text.trim()))) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [documents]);

  function replaceDocument(next: InstagramDocument, remember = true) {
    if (remember) history.current[format] = [...history.current[format].slice(-49), doc];
    setDocuments((previous) => ({ ...previous, [format]: next }));
  }

  function changeBlock(id: string, patch: Partial<InstagramBlock>, remember = true) {
    replaceDocument({ ...doc, blocks: doc.blocks.map((block) => block.id === id ? updateInstagramBlock(block, patch) : block) }, remember);
  }

  function addBlock(style: InstagramTextStyle) {
    if (doc.blocks.length >= MAX_INSTAGRAM_BLOCKS) return;
    const block = newInstagramBlock(style, doc.blocks.length);
    replaceDocument({ ...doc, blocks: [...doc.blocks, block] });
    setSelectedId(block.id);
    requestAnimationFrame(() => textRef.current?.focus());
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, block: InstagramBlock, layout: InstagramBlockLayout) {
    if (event.button !== 0) return;
    setSelectedId(block.id);
    history.current[format] = [...history.current[format].slice(-49), doc];
    drag.current = { id: block.id, clientX: event.clientX, clientY: event.clientY, x: block.x, y: block.y, height: layout.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!start || !stage?.width || !stage.height) return;
    changeBlock(start.id, {
      x: start.x + (event.clientX - start.clientX) / stage.width * 100,
      y: clamp(start.y + (event.clientY - start.clientY) / stage.height * 100, 0, Math.max(0, 100 - start.height / dimensions.height * 100)),
    }, false);
  }

  async function download() {
    if (!currentFile || !canExport) return;
    try {
      await downloadGraphicFiles([{ blob: currentFile, filename: currentFile.name }], currentFile.name);
      setFeedback('instagram.downloaded');
    } catch { setFeedback('instagram.error'); }
  }

  async function share() {
    if (!currentFile || !canExport || sharing) return;
    if (!canShareInstagram(currentFile)) { setFeedback('instagram.shareUnavailable'); return; }
    setSharing(true);
    try {
      await shareInstagram(currentFile);
      setFeedback('instagram.shared');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')) setFeedback('instagram.shareError');
    } finally { setSharing(false); }
  }

  const numberFields: Array<{ key: 'size' | 'width' | 'x' | 'y'; label: MessageKey; min: number; max: number }> = [
    { key: 'size', label: 'instagram.size', min: 24, max: 160 },
    { key: 'width', label: 'instagram.width', min: 15, max: 100 },
    { key: 'x', label: 'instagram.x', min: 0, max: selected ? 100 - selected.width : 100 },
    { key: 'y', label: 'instagram.y', min: 0, max: 95 },
  ];

  return <main id="main-content" className="instagram-studio">
    <header className="instagram-header">
      <div><Link className="text-action" to="/owner">← {t('instagram.back')}</Link><h1>{t('instagram.title')}</h1><p>{t('instagram.copy')}</p></div>
      <fieldset className="instagram-format"><legend>{t('instagram.format')}</legend>
        {(['feed', 'story'] as const).map((value) => <label key={value}>
          <input type="radio" name="instagram-format" value={value} checked={format === value} onChange={() => { setFormat(value); setSelectedId(null); setLayouts([]); }} />
          <span>{value === 'feed' ? 'Feed · 4:5' : 'Story · 9:16'}</span>
        </label>)}
      </fieldset>
    </header>
    <div className="instagram-workbench">
      <section className="instagram-controls" aria-labelledby="instagram-block-heading">
        <div className="instagram-section-title"><h2 id="instagram-block-heading">{t('instagram.blocks')}</h2><span>{doc.blocks.length}/{MAX_INSTAGRAM_BLOCKS}</span></div>
        <div className="instagram-actions">
          <button type="button" disabled={doc.blocks.length >= MAX_INSTAGRAM_BLOCKS} onClick={() => addBlock('h1')}>{t('instagram.addWhite')}</button>
          <button type="button" disabled={doc.blocks.length >= MAX_INSTAGRAM_BLOCKS} onClick={() => addBlock('h2')}>{t('instagram.addGradient')}</button>
        </div>
        <ol className="instagram-block-list" aria-label={t('instagram.blocks')}>
          {doc.blocks.map((block, index) => <li key={block.id}><button type="button" aria-label={`${block.style.toUpperCase()} ${block.text.trim() || `${t('instagram.block')} ${index + 1}`}`} aria-pressed={selected?.id === block.id} onClick={() => setSelectedId(block.id)}>
            <span>{block.style.toUpperCase()}</span><span>{block.text.trim() || `${t('instagram.block')} ${index + 1}`}</span>
          </button></li>)}
        </ol>
        {!selected ? <p>{t('instagram.empty')}</p> : <div className="instagram-properties">
          <label htmlFor="instagram-text">{t('instagram.text')}<textarea ref={textRef} id="instagram-text" value={selected.text} maxLength={500} rows={3} placeholder={t('instagram.placeholder')} onChange={(event) => changeBlock(selected.id, { text: event.target.value })} /></label>
          <label>{t('instagram.style')}<select value={selected.style} onChange={(event) => changeBlock(selected.id, { style: event.target.value as InstagramTextStyle })}>
            <option value="h1">{t('instagram.white')}</option><option value="h2">{t('instagram.gradient')}</option>
          </select></label>
          <div className="instagram-number-fields">{numberFields.map((field) => <label key={field.key}>{t(field.label)}
            <input type="number" min={field.min} max={field.max} step={1} value={Math.round(selected[field.key] * 10) / 10}
              onChange={(event) => changeBlock(selected.id, { [field.key]: event.target.valueAsNumber })} />
          </label>)}</div>
          <label>{t('instagram.align')}<select value={selected.align} onChange={(event) => changeBlock(selected.id, { align: event.target.value as InstagramBlock['align'] })}>
            <option value="left">{t('instagram.left')}</option><option value="center">{t('instagram.center')}</option><option value="right">{t('instagram.right')}</option>
          </select></label>
          <div className="instagram-actions">
            <button type="button" disabled={doc.blocks.length >= MAX_INSTAGRAM_BLOCKS} onClick={() => {
              const copy = updateInstagramBlock({ ...selected, id: crypto.randomUUID() }, { y: selected.y + 5 });
              replaceDocument({ ...doc, blocks: [...doc.blocks, copy] }); setSelectedId(copy.id);
            }}>{t('instagram.duplicate')}</button>
            <button type="button" onClick={() => { replaceDocument({ ...doc, blocks: doc.blocks.filter((block) => block.id !== selected.id) }); setSelectedId(null); }}>{t('instagram.remove')}</button>
          </div>
        </div>}
        <button className="instagram-undo" type="button" disabled={!history.current[format].length} onClick={() => {
          const previous = history.current[format].pop(); if (previous) replaceDocument(previous, false);
        }}>{t('instagram.undo')}</button>
        <p className="instagram-note">{t('instagram.draftHint')}</p>
      </section>
      <section className="instagram-preview" aria-labelledby="instagram-preview-heading">
        <div className="instagram-section-title"><h2 id="instagram-preview-heading">{t('instagram.preview')}</h2><span>{dimensions.width} × {dimensions.height}</span></div>
        <div className="instagram-stage-wrap">
          <div className="instagram-stage" ref={stageRef} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
            <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} aria-label={`${t('instagram.preview')} · ${format}`} role="img" />
            {layouts.map((layout) => {
              const block = doc.blocks.find((candidate) => candidate.id === layout.id);
              if (!block) return null;
              return <button type="button" key={block.id} className={`instagram-drag-block${selected?.id === block.id ? ' is-selected' : ''}`}
                aria-label={`${t('instagram.block')} ${doc.blocks.indexOf(block) + 1}: ${block.text || t('instagram.text')}`} aria-pressed={selected?.id === block.id}
                style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${Math.min(layout.height / dimensions.height * 100, 100 - block.y)}%` }}
                onClick={() => setSelectedId(block.id)} onDoubleClick={() => textRef.current?.focus()}
                onPointerDown={(event) => beginDrag(event, block, layout)} onPointerMove={moveDrag}
                onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                  event.preventDefault();
                  const step = event.shiftKey ? 2 : 0.2;
                  changeBlock(block.id, { x: block.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: block.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) });
                }}><span className="instagram-block-tag">{block.style.toUpperCase()}</span></button>;
            })}
          </div>
        </div>
        <p className="instagram-note">{hasText ? t('instagram.previewHint') : t('instagram.empty')}</p>
        <div className="instagram-export">
          <div className="instagram-actions">
            <button className="primary-action" type="button" onClick={() => void download()} disabled={!canExport}>{t('instagram.download')}</button>
            <button type="button" onClick={() => void share()} disabled={!canExport || !shareSupported || sharing}>{t('instagram.share')}</button>
          </div>
          <p className="instagram-render-status" role="status">{feedback ? t(feedback) : error ? t('instagram.error') : overflow ? t('instagram.overflow') : currentFile ? t('instagram.ready') : t('instagram.preparing')}</p>
          {error && <button type="button" onClick={() => setRetry((value) => value + 1)}>{t('instagram.retry')}</button>}
          <p className="instagram-note">{currentFile && !shareSupported ? t('instagram.shareUnavailable') : t('instagram.shareHint')}</p>
        </div>
      </section>
    </div>
  </main>;
}
