import { useState, type CSSProperties } from 'react';
import './themedTrackMap.css';

/** The SVG supplies geometry/alpha only; colors inherit the live personal theme.
 * An image retains intrinsic sizing, accessible naming and a load-error fallback.
 * CSS masks (including WebKit) avoid stale baked-in colors and image recoloring.
 */
export function ThemedTrackMap({ src, alt, className = '', fallback = alt }: {
  src: string; alt: string; className?: string; fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={className}>{fallback}</span>;
  return <span className={`themed-track-map ${className}`} style={{ '--track-map-url': `url("${src}")` } as CSSProperties}>
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', opacity: 0 }} />
  </span>;
}
