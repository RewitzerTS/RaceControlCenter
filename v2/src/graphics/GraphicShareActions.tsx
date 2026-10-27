import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { downloadGraphicFiles, type GraphicDownload } from './downloadGraphics';
import './graphicShare.css';

const messages = {
  de: { share: 'Teilen', current: 'Dieses Bild teilen', all: 'Alle Bilder teilen', download: 'Dieses Bild herunterladen', preparing: 'Bilder zum Teilen werden vorbereitet …', hint: 'Wähle im Teilen-Menü eine App, etwa WhatsApp oder Instagram. Verfügbare Apps hängen von deinem Gerät ab.', unsupported: 'Dein Browser unterstützt das Teilen von Bildern nicht. Lade die Grafik herunter und öffne sie in deiner gewünschten App.', singleOnly: 'Mehrere Bilder zusammen werden nicht unterstützt. Du kannst jedes Bild einzeln teilen.', error: 'Teilen ist gerade nicht möglich. Versuche es erneut oder lade die Grafik herunter.', prepareError: 'Die Bilder konnten nicht vorbereitet werden.', retry: 'Erneut vorbereiten', shared: 'An das Teilen-Menü übergeben. Schließe das Teilen in der gewählten App ab.' },
  en: { share: 'Share', current: 'Share this image', all: 'Share all images', download: 'Download this image', preparing: 'Preparing images for sharing …', hint: 'Choose an app, such as WhatsApp or Instagram, in the share menu. Available apps depend on your device.', unsupported: 'Your browser cannot share image files. Download the graphic and open it in your preferred app.', singleOnly: 'Sharing multiple images is not supported. You can share each image separately.', error: 'Sharing is unavailable. Try again or download the graphic.', prepareError: 'The images could not be prepared.', retry: 'Prepare again', shared: 'Sent to the share menu. Complete sharing in the selected app.' },
  es: { share: 'Compartir', current: 'Compartir esta imagen', all: 'Compartir todas las imágenes', download: 'Descargar esta imagen', preparing: 'Preparando imágenes para compartir …', hint: 'Elige una aplicación, como WhatsApp o Instagram, en el menú para compartir. Las aplicaciones disponibles dependen del dispositivo.', unsupported: 'Tu navegador no permite compartir imágenes. Descarga el gráfico y ábrelo en la aplicación que prefieras.', singleOnly: 'No se pueden compartir varias imágenes juntas. Puedes compartirlas por separado.', error: 'No se puede compartir ahora. Inténtalo de nuevo o descarga el gráfico.', prepareError: 'No se pudieron preparar las imágenes.', retry: 'Preparar de nuevo', shared: 'Enviado al menú para compartir. Completa el proceso en la aplicación elegida.' },
  fr: { share: 'Partager', current: 'Partager cette image', all: 'Partager toutes les images', download: 'Télécharger cette image', preparing: 'Préparation des images à partager …', hint: 'Choisissez une application, comme WhatsApp ou Instagram, dans le menu de partage. Les applications disponibles dépendent de votre appareil.', unsupported: 'Votre navigateur ne permet pas de partager des images. Téléchargez le visuel et ouvrez-le dans l’application souhaitée.', singleOnly: 'Le partage de plusieurs images est indisponible. Vous pouvez les partager séparément.', error: 'Le partage est indisponible. Réessayez ou téléchargez le visuel.', prepareError: 'Les images n’ont pas pu être préparées.', retry: 'Préparer à nouveau', shared: 'Transmis au menu de partage. Terminez dans l’application choisie.' },
};

export function canShareGraphicFiles(files: File[]) {
  try { return files.length > 0 && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files }); }
  catch { return false; }
}

/** prepare must be stable for the current selection; never await rendering inside a share click. */
export function GraphicShareActions({ prepare, pageIndex = 0, disabled = false }: {
  prepare: () => Promise<GraphicDownload[]>; pageIndex?: number; disabled?: boolean;
}) {
  const { language } = useI18n();
  const c = messages[language];
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState<{ prepare: typeof prepare; revision: number; files: File[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<'shared' | 'error' | null>(null);
  useEffect(() => {
    const invalidate = () => { setReady(null); setRevision(n => n + 1); };
    window.addEventListener('racevora:theme-changed', invalidate);
    return () => window.removeEventListener('racevora:theme-changed', invalidate);
  }, []);
  useEffect(() => {
    let active = true;
    setReady(null); setFailed(false); setFeedback(null);
    if (disabled) return;
    const timer = window.setTimeout(() => {
      void prepare().then(items => {
        if (!items.length) throw new Error('No graphics');
        if (active) setReady({ prepare, revision, files: items.map(item => new File([item.blob], item.filename, { type: 'image/png' })) });
      }).catch(() => { if (active) setFailed(true); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [prepare, disabled, revision]);
  const files = !disabled && ready?.prepare === prepare && ready.revision === revision ? ready.files : [];
  const current = files[Math.min(pageIndex, files.length - 1)];
  const canCurrent = !!current && canShareGraphicFiles([current]);
  const canAll = canShareGraphicFiles(files);
  async function share(selected: File[]) {
    if (sharing || !canShareGraphicFiles(selected)) return;
    setSharing(true); setFeedback(null);
    try {
      // Must happen in the original click, before any asynchronous work.
      await navigator.share({ files: selected });
      setFeedback('shared');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')) setFeedback('error');
    } finally { setSharing(false); }
  }
  return <div className="graphic-share-actions" aria-busy={!disabled && !files.length && !failed}>
    <div className="graphic-share-buttons">
      <button type="button" disabled={!canCurrent || sharing} onClick={() => current && void share([current])}>{files.length > 1 ? c.current : c.share}</button>
      {files.length > 1 && <>
        <button type="button" disabled={!canAll || sharing} onClick={() => void share(files)}>{c.all}</button>
        <button type="button" disabled={sharing} onClick={() => current && void downloadGraphicFiles([{ blob: current, filename: current.name }], current.name).catch(() => setFeedback('error'))}>{c.download}</button>
      </>}
      {failed && <button type="button" onClick={() => setRevision(n => n + 1)}>{c.retry}</button>}
    </div>
    <p role="status">{feedback ? c[feedback] : failed ? c.prepareError : disabled ? '' : !files.length ? c.preparing : !canCurrent ? c.unsupported : files.length > 1 && !canAll ? c.singleOnly : c.hint}</p>
  </div>;
}
