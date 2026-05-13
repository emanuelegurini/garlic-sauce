import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import type { AppDatabase } from './database';
import type { FillStyle, StrokeStyle, TextRun } from './import/types';
import { renderAndStoreSlideImage, storeSlideImage, type RenderedSlideImage } from './rasterizer';

const DEFAULT_WIDTH_PX = 1280;
const FALLBACK_SLIDE_WIDTH_EMU = 12_192_000;
const FALLBACK_SLIDE_HEIGHT_EMU = 6_858_000;

type SlideRow = {
  background_json: string | null;
  height_emu: number;
  id: number;
  presentation_id: number;
  slide_order: number;
  width_emu: number;
};

type ShapeRow = {
  fill_json: string | null;
  height_emu: number | null;
  id: number;
  kind: string;
  media_relationship_id: string | null;
  preset: string | null;
  rotation: number | null;
  stroke_json: string | null;
  width_emu: number | null;
  x_emu: number | null;
  y_emu: number | null;
};

type TextRunRow = {
  alignment: string | null;
  bold: 0 | 1;
  colour: string | null;
  content: string;
  font_family: string | null;
  font_size_pt: number | null;
  italic: 0 | 1;
  run_order: number;
  shape_id: number;
};

type MediaRow = {
  content_type: string;
  data: Buffer;
  relationship_id: string;
};

type RenderOptions = {
  onProgress?: (progress: { slideCount: number; slideIndex: number }) => void;
  widthPx?: number;
};

function parseJsonStyle<T>(json: string | null): T | undefined {
  if (!json) {
    return undefined;
  }

  return JSON.parse(json) as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cssUrl(value: string): string {
  return `url("${value.replace(/"/g, '%22')}")`;
}

function cssColour(value: string | undefined, fallback: string): string {
  if (!value || value.startsWith('scheme:') || value.startsWith('preset:')) {
    return fallback;
  }

  return value;
}

function cssFill(fill: FillStyle | undefined, mediaByRelationship: Map<string, MediaRow>): string {
  if (!fill || fill.kind === 'none') {
    return 'transparent';
  }

  if (fill.kind === 'solid') {
    return cssColour(fill.colour, 'transparent');
  }

  if (fill.kind === 'gradient') {
    const stops = fill.stops
      .map((stop) => `${cssColour(stop.colour, '#ffffff')} ${Math.round(stop.position * 100)}%`)
      .join(', ');

    return stops.length > 0 ? `linear-gradient(180deg, ${stops})` : 'transparent';
  }

  if (fill.kind === 'image' && fill.relationshipId) {
    const media = mediaByRelationship.get(fill.relationshipId);
    const dataUrl = media ? mediaDataUrl(media) : undefined;

    if (dataUrl) {
      return `${cssUrl(dataUrl)} center / 100% 100% no-repeat`;
    }
  }

  return 'transparent';
}

function slideOutputSize(
  slide: SlideRow,
  requestedWidthPx?: number,
): { heightPx: number; widthPx: number } {
  const slideWidthEmu = slide.width_emu > 0 ? slide.width_emu : FALLBACK_SLIDE_WIDTH_EMU;
  const slideHeightEmu = slide.height_emu > 0 ? slide.height_emu : FALLBACK_SLIDE_HEIGHT_EMU;
  const widthPx = Math.max(1, Math.round(requestedWidthPx ?? DEFAULT_WIDTH_PX));
  const heightPx = Math.max(1, Math.round((widthPx * slideHeightEmu) / slideWidthEmu));

  return { heightPx, widthPx };
}

function emuToPixels(value: number | null | undefined, scale: number): number {
  return Math.round((value ?? 0) * scale);
}

function strokeWidth(stroke: StrokeStyle | undefined, scale: number): number {
  if (!stroke) {
    return 0;
  }

  return Math.max(1, emuToPixels(stroke.widthEmu ?? 9_525, scale));
}

function mediaDataUrl(media: MediaRow): string | undefined {
  if (
    media.content_type !== 'image/png' &&
    media.content_type !== 'image/jpeg' &&
    media.content_type !== 'image/gif' &&
    media.content_type !== 'image/svg+xml'
  ) {
    return undefined;
  }

  return `data:${media.content_type};base64,${media.data.toString('base64')}`;
}

function slideRows(database: AppDatabase, presentationId: number): SlideRow[] {
  return database
    .prepare(
      `
        SELECT id, presentation_id, slide_order, width_emu, height_emu, background_json
        FROM slides
        WHERE presentation_id = ?
        ORDER BY slide_order
      `,
    )
    .all(presentationId) as SlideRow[];
}

function shapeRows(database: AppDatabase, slideId: number): ShapeRow[] {
  return database
    .prepare(
      `
        SELECT
          id,
          kind,
          preset,
          x_emu,
          y_emu,
          width_emu,
          height_emu,
          rotation,
          fill_json,
          stroke_json,
          media_relationship_id
        FROM shapes
        WHERE slide_id = ?
        ORDER BY shape_order
      `,
    )
    .all(slideId) as ShapeRow[];
}

function textRunsByShape(database: AppDatabase, slideId: number): Map<number, TextRun[]> {
  const rows = database
    .prepare(
      `
        SELECT
          text_runs.shape_id,
          text_runs.run_order,
          text_runs.content,
          text_runs.font_family,
          text_runs.font_size_pt,
          text_runs.bold,
          text_runs.italic,
          text_runs.colour,
          text_runs.alignment
        FROM text_runs
        INNER JOIN shapes ON shapes.id = text_runs.shape_id
        WHERE shapes.slide_id = ?
        ORDER BY text_runs.shape_id, text_runs.run_order
      `,
    )
    .all(slideId) as TextRunRow[];
  const runsByShape = new Map<number, TextRun[]>();

  for (const row of rows) {
    const runs = runsByShape.get(row.shape_id) ?? [];
    runs.push({
      alignment: row.alignment ?? undefined,
      bold: row.bold === 1,
      colour: row.colour ?? undefined,
      content: row.content,
      fontFamily: row.font_family ?? undefined,
      fontSizePt: row.font_size_pt ?? undefined,
      italic: row.italic === 1,
    });
    runsByShape.set(row.shape_id, runs);
  }

  return runsByShape;
}

function mediaRowsByRelationship(database: AppDatabase, slideId: number): Map<string, MediaRow> {
  const rows = database
    .prepare(
      `
        SELECT relationship_id, content_type, data
        FROM media
        WHERE slide_id = ? AND kind = 'image'
      `,
    )
    .all(slideId) as MediaRow[];

  return new Map(rows.map((row) => [row.relationship_id, row]));
}

function renderTextRuns(runs: TextRun[]): string {
  if (runs.length === 0) {
    return '';
  }

  return runs
    .map((run) => {
      const styles = [
        `font-family: ${JSON.stringify(run.fontFamily ?? 'Arial, Helvetica, sans-serif')}`,
        `font-size: ${run.fontSizePt ?? 18}pt`,
        `font-weight: ${run.bold ? 700 : 400}`,
        `font-style: ${run.italic ? 'italic' : 'normal'}`,
        `color: ${cssColour(run.colour, '#202124')}`,
      ];

      return `<span style="${styles.join(';')}">${escapeHtml(run.content)}</span>`;
    })
    .join('');
}

function textAlignment(runs: TextRun[]): string {
  const alignment = runs.find((run) => run.alignment)?.alignment;

  if (alignment === 'ctr' || alignment === 'center') {
    return 'center';
  }

  if (alignment === 'r' || alignment === 'right') {
    return 'right';
  }

  return 'left';
}

function renderConnector(
  shape: ShapeRow,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: StrokeStyle | undefined,
  scale: number,
): string {
  const lineWidth = strokeWidth(stroke, scale);
  const colour = cssColour(stroke?.colour, '#202124');

  return `
    <svg class="shape" style="left:${x}px;top:${y}px;width:${Math.max(1, width)}px;height:${Math.max(1, height)}px" viewBox="0 0 ${Math.max(1, width)} ${Math.max(1, height)}" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="${Math.max(1, width)}" y2="${Math.max(1, height)}" stroke="${escapeHtml(colour)}" stroke-width="${lineWidth || 1}" />
    </svg>
  `;
}

function renderImageShape(
  shape: ShapeRow,
  mediaByRelationship: Map<string, MediaRow>,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const media = shape.media_relationship_id
    ? mediaByRelationship.get(shape.media_relationship_id)
    : undefined;
  const dataUrl = media ? mediaDataUrl(media) : undefined;

  if (!dataUrl) {
    return `<div class="shape image-placeholder" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">Image</div>`;
  }

  return `<img class="shape image-shape" src="${dataUrl}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px" />`;
}

function renderShape(
  shape: ShapeRow,
  runs: TextRun[],
  mediaByRelationship: Map<string, MediaRow>,
  scaleX: number,
  scaleY: number,
): string {
  const x = emuToPixels(shape.x_emu, scaleX);
  const y = emuToPixels(shape.y_emu, scaleY);
  const width = Math.max(0, emuToPixels(shape.width_emu, scaleX));
  const height = Math.max(0, emuToPixels(shape.height_emu, scaleY));

  if (width <= 0 || height <= 0) {
    return '';
  }

  const scale = (scaleX + scaleY) / 2;
  const fill = parseJsonStyle<FillStyle>(shape.fill_json);
  const stroke = parseJsonStyle<StrokeStyle>(shape.stroke_json);

  if (shape.kind === 'connector' || shape.preset === 'line') {
    return renderConnector(shape, x, y, width, height, stroke, scale);
  }

  if (shape.kind === 'image') {
    return renderImageShape(shape, mediaByRelationship, x, y, width, height);
  }

  const borderWidth = strokeWidth(stroke, scale);
  const border =
    borderWidth > 0 ? `${borderWidth}px solid ${cssColour(stroke?.colour, '#202124')}` : '0';
  const rotation = shape.rotation ? `rotate(${shape.rotation}deg)` : 'none';
  const borderRadius = shape.preset === 'ellipse' ? '50%' : '0';
  const text = renderTextRuns(runs);

  return `
    <div class="shape text-shape" style="
      left:${x}px;
      top:${y}px;
      width:${width}px;
      height:${height}px;
      background:${cssFill(fill, mediaByRelationship)};
      border:${border};
      border-radius:${borderRadius};
      transform:${rotation};
      text-align:${textAlignment(runs)};
    ">${text}</div>
  `;
}

function renderHtml(
  database: AppDatabase,
  slide: SlideRow,
  widthPx: number,
  heightPx: number,
): string {
  const slideWidthEmu = slide.width_emu > 0 ? slide.width_emu : FALLBACK_SLIDE_WIDTH_EMU;
  const slideHeightEmu = slide.height_emu > 0 ? slide.height_emu : FALLBACK_SLIDE_HEIGHT_EMU;
  const scaleX = widthPx / slideWidthEmu;
  const scaleY = heightPx / slideHeightEmu;
  const background = parseJsonStyle<FillStyle>(slide.background_json);
  const mediaByRelationship = mediaRowsByRelationship(database, slide.id);
  const runsByShape = textRunsByShape(database, slide.id);
  const shapes = shapeRows(database, slide.id)
    .map((shape) =>
      renderShape(shape, runsByShape.get(shape.id) ?? [], mediaByRelationship, scaleX, scaleY),
    )
    .join('\n');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body {
            width: ${widthPx}px;
            height: ${heightPx}px;
            margin: 0;
            overflow: hidden;
            background: ${cssFill(background, mediaByRelationship) || '#ffffff'};
          }
          .slide {
            position: relative;
            width: ${widthPx}px;
            height: ${heightPx}px;
            overflow: hidden;
            background: transparent;
          }
          .shape {
            position: absolute;
            overflow: hidden;
          }
          .text-shape {
            display: flex;
            align-items: center;
            padding: 0.18em;
            line-height: 1.08;
            white-space: pre-wrap;
          }
          .image-shape {
            object-fit: fill;
          }
          .image-placeholder {
            display: grid;
            place-items: center;
            border: 1px solid #8a949e;
            color: #202124;
            background: #f4f6f8;
            font: 18px Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <main class="slide">${shapes}</main>
      </body>
    </html>
  `;
}

async function waitForBrowserAssets(window: ElectronBrowserWindow): Promise<void> {
  await window.webContents.executeJavaScript(`
    Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) return undefined;
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    })).then(() => document.fonts && document.fonts.ready ? document.fonts.ready : undefined)
  `);
}

async function captureSlide(
  window: ElectronBrowserWindow,
  database: AppDatabase,
  slide: SlideRow,
  widthPx: number,
  heightPx: number,
): Promise<RenderedSlideImage> {
  const filePath = path.join(os.tmpdir(), `garlic-sauce-slide-${randomUUID()}.html`);

  await fs.writeFile(filePath, renderHtml(database, slide, widthPx, heightPx), 'utf8');

  try {
    await window.loadFile(filePath);
    await waitForBrowserAssets(window);

    const image = await window.webContents.capturePage({
      height: heightPx,
      width: widthPx,
      x: 0,
      y: 0,
    });
    const png = image.toPNG();

    return {
      data: png,
      heightPx,
      presentationId: slide.presentation_id,
      slideId: slide.id,
      slideOrder: slide.slide_order,
      widthPx,
    };
  } finally {
    await fs.rm(filePath, { force: true });
  }
}

export async function renderAndStorePresentationSlidesWithBrowser(
  database: AppDatabase,
  presentationId: number,
  options: RenderOptions = {},
): Promise<{ failed: number; rendered: number }> {
  const { BrowserWindow } = await import('electron');
  const slides = slideRows(database, presentationId);
  let failed = 0;
  let rendered = 0;

  if (slides.length === 0) {
    return { failed, rendered };
  }

  const firstSize = slideOutputSize(slides[0], options.widthPx);
  const window = new BrowserWindow({
    height: firstSize.heightPx,
    show: false,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      sandbox: true,
    },
    width: firstSize.widthPx,
  });

  try {
    window.webContents.setZoomFactor(1);

    for (const [index, slide] of slides.entries()) {
      const { heightPx, widthPx } = slideOutputSize(slide, options.widthPx);
      window.setContentSize(widthPx, heightPx);

      try {
        storeSlideImage(database, await captureSlide(window, database, slide, widthPx, heightPx));
      } catch {
        failed += 1;
        renderAndStoreSlideImage(database, slide.id, { widthPx });
      }

      rendered += 1;
      options.onProgress?.({
        slideCount: slides.length,
        slideIndex: index + 1,
      });
    }
  } finally {
    window.close();
  }

  return { failed, rendered };
}
