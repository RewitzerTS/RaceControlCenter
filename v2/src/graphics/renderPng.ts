import type { GraphicFormat, GraphicModel } from './graphics';

export const GRAPHIC_DIMENSIONS: Record<GraphicFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, weight = 700) {
  let size = startSize;
  do {
    context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    if (context.measureText(value).width <= maxWidth) return size;
    size -= 2;
  } while (size > 30);
  return size;
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, color: string, weight = 700) {
  fitText(context, text, maxWidth, size, weight);
  context.fillStyle = color;
  context.fillText(text, x, y, maxWidth);
}

export function drawGraphic(canvas: HTMLCanvasElement, model: GraphicModel, format: GraphicFormat) {
  const dimensions = GRAPHIC_DIMENSIONS[format];
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG renderer is not available.');

  const { width, height } = dimensions;
  const isLandscape = format === 'landscape';
  const margin = isLandscape ? 112 : 82;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#031727');
  gradient.addColorStop(0.58, '#0b2440');
  gradient.addColorStop(1, '#102849');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#7653c7';
  context.fillRect(0, 0, 18, height);
  context.fillStyle = '#2c8fa6';
  context.fillRect(18, 0, 8, height);

  context.fillStyle = 'rgba(120, 197, 213, 0.12)';
  context.beginPath();
  context.arc(width + 40, -40, 330, 0, Math.PI * 2);
  context.fill();

  drawText(context, 'RACEVORA', margin, 94, 560, 34, '#78c5d5', 800);
  context.textAlign = 'right';
  drawText(context, model.eyebrow.toUpperCase(), width - margin, 94, 500, 26, '#b9c5d1', 700);
  context.textAlign = 'left';

  const titleY = format === 'story' ? 310 : isLandscape ? 230 : 250;
  drawText(context, model.title, margin, titleY, width - margin * 2, format === 'story' ? 92 : isLandscape ? 88 : 80, '#f7f9fc', 800);
  drawText(context, model.subtitle, margin, titleY + 68, width - margin * 2, 32, '#b9c5d1', 500);

  if (model.hero) {
    const heroY = format === 'story' ? 760 : isLandscape ? 540 : 610;
    drawText(context, model.hero, margin, heroY, width - margin * 2, format === 'story' ? 116 : isLandscape ? 104 : 96, '#a68be7', 800);
  }

  if (model.rows.length) {
    const availableHeight = height - titleY - 250;
    const rowHeight = Math.min(format === 'story' ? 118 : isLandscape ? 82 : 88, Math.floor(availableHeight / model.rows.length));
    const startY = titleY + 145;
    model.rows.forEach((row, index) => {
      const y = startY + rowHeight * index;
      if (index > 0) {
        context.fillStyle = 'rgba(185, 197, 209, 0.18)';
        context.fillRect(margin, y - 39, width - margin * 2, 1);
      }
      drawText(context, row.rank, margin, y, 90, 30, '#78c5d5', 800);
      drawText(context, row.primary, margin + 110, y, isLandscape ? 900 : 470, 34, '#f7f9fc', 700);
      drawText(context, row.secondary, margin + 110, y + 32, isLandscape ? 860 : 430, 21, '#b9c5d1', 500);
      context.textAlign = 'right';
      drawText(context, row.value, width - margin, y + 7, isLandscape ? 420 : 270, 27, '#f7f9fc', 700);
      context.textAlign = 'left';
    });
  }

  context.fillStyle = 'rgba(185, 197, 209, 0.25)';
  context.fillRect(margin, height - 116, width - margin * 2, 1);
  drawText(context, model.footer, margin, height - 66, width - margin * 2, 23, '#b9c5d1', 500);
  context.textAlign = 'right';
  drawText(context, 'racevora.app', width - margin, height - 66, 260, 23, '#78c5d5', 700);
  context.textAlign = 'left';
}

export async function renderGraphicPng(model: GraphicModel, format: GraphicFormat): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawGraphic(canvas, model, format);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
}

export function downloadPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
