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

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Ein Ergebnisbild konnte nicht gelesen werden.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`„${file.name}“ ist kein lesbares Bild.`));
    };
    image.src = url;
  });
}

async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`„${file.name}“ ist keine Bilddatei.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`„${file.name}“ ist größer als 20 MB.`);

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Das Ergebnisbild konnte nicht vorbereitet werden.');
  context.fillStyle = '#11161a';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Das Ergebnisbild konnte nicht komprimiert werden.');
  return readAsDataUrl(blob);
}

export async function prepareRaceResultImages(files: File[]): Promise<string[]> {
  if (!files.length || files.length > MAX_IMAGES) throw new Error('Bitte 1 bis 8 Ergebnisbilder auswählen.');
  return Promise.all(files.map(prepareImage));
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
  const response = await client.functions.invoke('analyze-race-result-images', {
    headers: { 'x-rcc-league-slug': leagueSlug },
    body: {
      images,
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
}

function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function analysisToReviewCsv(analysis: AiResultAnalysis): string {
  const header = 'driver;finish_position;grid_position;points;team_name;car_name';
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
    ].join(';'));
  if (!rows.length) throw new Error('Die KI-Erkennung enthält keine gültigen Zielpositionen.');
  return `${header}\n${rows.join('\n')}`;
}
