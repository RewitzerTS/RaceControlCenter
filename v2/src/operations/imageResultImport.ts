import type { LeagueSupabaseClient } from '../lib/supabase';
import type { LeagueDriver } from './operations';

export type AiResultRow = {
  position: number | null;
  driver: string;
  team: string | null;
  grid_position: number | null;
  pit_stops: number | null;
  fastest_lap: string | null;
  race_time: string | null;
  confidence: number;
};

export type AiResultAnalysis = {
  race_name: string | null;
  rows: AiResultRow[];
  warnings: string[];
};

const MAX_IMAGES = 8;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 1800;
const IMAGE_PREP_CONCURRENCY = 2;
const IMAGE_PREP_TIMEOUT_MS = 30_000;
const TEMP_IMAGE_BUCKET = 'result-import-images';
const TEMP_IMAGE_TTL_SECONDS = 10 * 60;
const SUPPORTED_IMAGE_NAME = /\.(?:heic|heif|jpe?g|png|webp)$/i;
const HEIC_IMAGE_NAME = /\.(?:heic|heif)$/i;
const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIF_FILE_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

export function isHeicResultImage(file: Pick<File, 'name' | 'type'>): boolean {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || HEIC_IMAGE_NAME.test(file.name);
}

function isSupportedResultImage(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || SUPPORTED_IMAGE_NAME.test(file.name);
}

export async function hasHeicResultImageSignature(file: Blob): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (bytes.length < 12) return false;
    const header = String.fromCharCode(...bytes);
    return header.slice(4, 8) === 'ftyp' && HEIF_FILE_BRANDS.some((brand) => header.slice(8).includes(brand));
  } catch {
    return false;
  }
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Ein Ergebnisbild konnte nicht gelesen werden.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

function withTimeout<T>(promise: Promise<T>, message: string, onLateResolve?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      reject(new Error(message));
    }, IMAGE_PREP_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        if (timedOut) {
          onLateResolve?.(value);
          return;
        }
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        if (!timedOut) reject(error);
      },
    );
  });
}

function loadImageElement(file: Blob, displayName: string): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`„${displayName}“ ist kein lesbares Bild.`));
    };
    image.src = url;
  });
}

async function decodeImage(file: Blob, displayName: string): Promise<DecodedImage> {
  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await withTimeout(
        window.createImageBitmap(file),
        `„${displayName}“ konnte nicht rechtzeitig decodiert werden.`,
        (lateBitmap) => lateBitmap.close(),
      );
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Some mobile browsers expose createImageBitmap but reject individual image variants.
    }
  }
  return withTimeout(
    loadImageElement(file, displayName),
    `„${displayName}“ konnte nicht rechtzeitig geladen werden.`,
    (lateImage) => lateImage.cleanup(),
  );
}

async function convertHeicImage(file: File): Promise<Blob[]> {
  try {
    const { default: heic2any } = await import('heic2any');
    const source = HEIC_MIME_TYPES.has(file.type.toLowerCase())
      ? file
      : file.slice(0, file.size, 'image/heic');
    const converted = await heic2any({
      blob: source,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    const images = (Array.isArray(converted) ? converted : [converted])
      .filter((image): image is Blob => image instanceof Blob && image.size > 0);
    if (!images.length) throw new Error('empty conversion');
    return images;
  } catch {
    throw new Error(`„${file.name}“ konnte nicht aus HEIC/HEIF konvertiert werden. Bitte verwende das Original oder exportiere das Bild als JPG.`);
  }
}

async function decodeHeicImage(file: File): Promise<DecodedImage> {
  try {
    // Safari and newer Apple devices can decode HEIC directly. Avoid downloading
    // and executing the large fallback converter when the browser already can.
    return await decodeImage(file, file.name);
  } catch {
    const convertedImages = await convertHeicImage(file);
    for (const image of convertedImages) {
      try {
        return await decodeImage(image, file.name);
      } catch {
        // HEIF containers may include auxiliary frames. Use the first frame the
        // browser can actually decode instead of assuming item zero is visible.
      }
    }
    throw new Error(`„${file.name}“ wurde konvertiert, enthält aber kein lesbares Ergebnisbild. Bitte exportiere das Bild als JPG.`);
  }
}

async function prepareImage(file: File): Promise<string> {
  const isHeic = isHeicResultImage(file) || await hasHeicResultImageSignature(file);
  if (!isHeic && !isSupportedResultImage(file)) throw new Error(`„${file.name}“ ist keine unterstützte Bilddatei. Erlaubt sind JPG, PNG, WebP, HEIC und HEIF.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`„${file.name}“ ist größer als 20 MB.`);

  const decoded = isHeic ? await decodeHeicImage(file) : await decodeImage(file, file.name);
  try {
    const longestEdge = Math.max(decoded.width, decoded.height);
    if (!longestEdge) throw new Error(`„${file.name}“ hat ungültige Abmessungen.`);
    const scale = Math.min(1, MAX_EDGE / longestEdge);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Das Ergebnisbild konnte nicht vorbereitet werden.');
    context.fillStyle = '#11161a';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88)),
      `„${file.name}“ konnte nicht rechtzeitig komprimiert werden.`,
    );
    if (!blob) throw new Error('Das Ergebnisbild konnte nicht komprimiert werden.');
    return withTimeout(readAsDataUrl(blob), `„${file.name}“ konnte nach der Komprimierung nicht gelesen werden.`);
  } finally {
    decoded.cleanup();
  }
}

export type ImagePreparationProgress = {
  completed: number;
  total: number;
  fileName: string;
};

export async function prepareRaceResultImages(
  files: File[],
  onProgress?: (progress: ImagePreparationProgress) => void,
): Promise<string[]> {
  if (!files.length || files.length > MAX_IMAGES) throw new Error('Bitte 1 bis 8 Ergebnisbilder auswählen.');
  const results = new Array<string>(files.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(IMAGE_PREP_CONCURRENCY, files.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await prepareImage(files[index]);
      completed += 1;
      onProgress?.({ completed, total: files.length, fileName: files[index].name });
    }
  }));

  return results;
}

function validateAnalysis(value: unknown): AiResultAnalysis {
  if (!value || typeof value !== 'object') throw new Error('Die KI hat keine auswertbaren Ergebnisdaten geliefert.');
  const candidate = value as Partial<AiResultAnalysis>;
  if (!Array.isArray(candidate.rows) || candidate.rows.length === 0) {
    throw new Error('Auf den Bildern wurden keine Ergebniszeilen erkannt.');
  }
  return {
    race_name: typeof candidate.race_name === 'string' ? candidate.race_name : null,
    rows: candidate.rows,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
  };
}

export async function analyzeRaceResultImages(
  client: LeagueSupabaseClient,
  leagueSlug: string,
  images: string[],
  drivers: LeagueDriver[],
  raceName: string,
): Promise<AiResultAnalysis> {
  const userResponse = await client.auth.getUser();
  if (userResponse.error || !userResponse.data.user?.id) {
    throw new Error('Keine gültige Sitzung für den Bilderimport.');
  }

  const storage = client.storage.from(TEMP_IMAGE_BUCKET);
  const uploadedPaths: string[] = [];
  const imageUrls: string[] = [];
  try {
    for (const [index, image] of images.entries()) {
      const separator = image.indexOf(',');
      if (separator < 0) throw new Error('Ein vorbereitetes Ergebnisbild ist ungültig.');
      const binary = atob(image.slice(separator + 1));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const path = `${leagueSlug}/${userResponse.data.user.id}/${crypto.randomUUID()}-${index + 1}.jpg`;
      const upload = await storage.upload(path, new Blob([bytes], { type: 'image/jpeg' }), {
        cacheControl: '60',
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploadedPaths.push(upload.data.path);
      const signed = await storage.createSignedUrl(upload.data.path, TEMP_IMAGE_TTL_SECONDS);
      if (signed.error || !signed.data.signedUrl) throw signed.error || new Error('Temporärer Bildzugriff konnte nicht erstellt werden.');
      imageUrls.push(signed.data.signedUrl);
    }

    const response = await client.functions.invoke('analyze-race-result-images', {
      headers: { 'x-rcc-league-slug': leagueSlug },
      body: {
        image_urls: imageUrls,
        race_name: raceName,
        drivers: drivers.filter((driver) => driver.is_active).map((driver) => ({
          display_name: driver.display_name,
          gamertag: driver.gamertag,
          team: driver.league_team,
        })),
      },
    });
    if (response.error) {
      let detail = response.error.message;
      const context = (response.error as { context?: Response }).context;
      if (context) {
        try {
          const payload = await context.clone().json() as { message?: string; error?: string };
          detail = payload.message || payload.error || detail;
        } catch {
          // Keep the safe client message when the response is not JSON.
        }
      }
      throw new Error(detail);
    }
    return validateAnalysis(response.data);
  } finally {
    if (uploadedPaths.length) await storage.remove(uploadedPaths).catch(() => undefined);
  }
}

function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function analysisToReviewCsv(analysis: AiResultAnalysis): string {
  const header = 'driver;finish_position;grid_position;points;team_name;car_name;pit_stops;fastest_lap_time;race_time';
  const rows = analysis.rows
    .filter((row) => row.driver.trim() && Number.isInteger(row.position) && Number(row.position) > 0)
    .sort((left, right) => Number(left.position) - Number(right.position))
    .map((row) => [
      csvCell(row.driver.trim()),
      String(row.position),
      row.grid_position == null ? '' : String(row.grid_position),
      'PRÜFEN',
      csvCell(row.team?.trim() || ''),
      '',
      row.pit_stops == null ? '' : String(row.pit_stops),
      csvCell(row.fastest_lap?.trim() || ''),
      csvCell(row.race_time?.trim() || ''),
    ].join(';'));
  if (!rows.length) throw new Error('Die KI-Erkennung enthält keine gültigen Zielpositionen.');
  return `${header}\n${rows.join('\n')}`;
}
