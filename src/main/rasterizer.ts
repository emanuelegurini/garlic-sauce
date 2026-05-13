import zlib from 'node:zlib';
import type { AppDatabase } from './database';
import type { FillStyle, StrokeStyle, TextRun } from './import/types';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_WIDTH_PX = 1280;
const EMU_PER_INCH = 914_400;
const FALLBACK_SLIDE_WIDTH_EMU = 12_192_000;
const FALLBACK_SLIDE_HEIGHT_EMU = 6_858_000;

type Rgba = readonly [number, number, number, number];

type Canvas = {
  height: number;
  pixels: Uint8Array;
  width: number;
};

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
  shape_order: number;
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

export type RenderedSlideImage = {
  data: Buffer;
  heightPx: number;
  presentationId: number;
  renderError?: string;
  slideId: number;
  slideOrder: number;
  widthPx: number;
};

export type StoredSlideImage = RenderedSlideImage;

type RenderOptions = {
  widthPx?: number;
};

type RenderPresentationOptions = RenderOptions & {
  onProgress?: (progress: { slideIndex: number; slideCount: number }) => void;
};

type DecodedPng = {
  height: number;
  pixels: Uint8Array;
  width: number;
};

type TextStyle = {
  alignment?: string;
  bold: boolean;
  colour: Rgba;
  fontFamily?: string;
  fontSizePt: number;
  italic: boolean;
};

type GlyphMap = Record<string, readonly string[]>;

const TRANSPARENT: Rgba = [0, 0, 0, 0];
const BLACK: Rgba = [32, 33, 36, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const PLACEHOLDER_FILL: Rgba = [244, 246, 248, 255];
const PLACEHOLDER_STROKE: Rgba = [138, 148, 158, 255];

const GLYPHS: GlyphMap = {
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
  '!': ['1', '1', '1', '1', '1', '0', '1'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  "'": ['1', '1', '0', '0', '0', '0', '0'],
  '(': ['01', '10', '10', '10', '10', '10', '01'],
  ')': ['10', '01', '01', '01', '01', '01', '10'],
  ',': ['0', '0', '0', '0', '0', '1', '1'],
  '-': ['0000', '0000', '0000', '1111', '0000', '0000', '0000'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  ':': ['0', '1', '0', '0', '0', '1', '0'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['010', '110', '010', '010', '010', '010', '111'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

let crcTable: Uint32Array | undefined;

function getCrcTable(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb8_8320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function crc32(buffer: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffff_ffff;

  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  const payload = Buffer.concat([typeBuffer, data]);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(payload), 0);

  return Buffer.concat([length, payload, crc]);
}

export function encodeRgbaPng(width: number, height: number, pixels: Uint8Array): Buffer {
  if (width <= 0 || height <= 0) {
    throw new Error('PNG dimensions must be positive.');
  }

  if (pixels.length !== width * height * 4) {
    throw new Error('RGBA pixel data does not match PNG dimensions.');
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const scanlines = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (1 + width * 4);
    const sourceOffset = y * width * 4;
    scanlines.writeUInt8(0, scanlineOffset);
    Buffer.from(pixels.buffer, pixels.byteOffset + sourceOffset, width * 4).copy(
      scanlines,
      scanlineOffset + 1,
    );
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function assertPngSignature(buffer: Buffer): void {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Image data is not a PNG.');
  }
}

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const prediction = left + above - upperLeft;
  const distanceLeft = Math.abs(prediction - left);
  const distanceAbove = Math.abs(prediction - above);
  const distanceUpperLeft = Math.abs(prediction - upperLeft);

  if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) {
    return left;
  }

  if (distanceAbove <= distanceUpperLeft) {
    return above;
  }

  return upperLeft;
}

export function decodePng(buffer: Buffer): DecodedPng {
  assertPngSignature(buffer);

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.length) {
      throw new Error('PNG chunk is truncated.');
    }

    const data = buffer.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colourType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || interlace !== 0) {
    throw new Error('Unsupported PNG metadata.');
  }

  if (colourType !== 2 && colourType !== 6) {
    throw new Error('Only true-colour PNG images are supported.');
  }

  const bytesPerPixel = colourType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rgbaPixels = new Uint8Array(width * height * 4);
  let sourceOffset = 0;
  let previousRow = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated.readUInt8(sourceOffset);
    sourceOffset += 1;
    const row = new Uint8Array(stride);

    for (let index = 0; index < stride; index += 1) {
      const raw = inflated.readUInt8(sourceOffset + index);
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const above = previousRow[index] ?? 0;
      const upperLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;

      switch (filter) {
        case 0:
          row[index] = raw;
          break;
        case 1:
          row[index] = (raw + left) & 0xff;
          break;
        case 2:
          row[index] = (raw + above) & 0xff;
          break;
        case 3:
          row[index] = (raw + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4:
          row[index] = (raw + paethPredictor(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error('Unsupported PNG scanline filter.');
      }
    }

    for (let x = 0; x < width; x += 1) {
      const targetOffset = (y * width + x) * 4;
      const sourcePixelOffset = x * bytesPerPixel;
      rgbaPixels[targetOffset] = row[sourcePixelOffset];
      rgbaPixels[targetOffset + 1] = row[sourcePixelOffset + 1];
      rgbaPixels[targetOffset + 2] = row[sourcePixelOffset + 2];
      rgbaPixels[targetOffset + 3] = colourType === 6 ? row[sourcePixelOffset + 3] : 255;
    }

    sourceOffset += stride;
    previousRow = row;
  }

  return {
    height,
    pixels: rgbaPixels,
    width,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createCanvas(width: number, height: number, colour: Rgba = WHITE): Canvas {
  const canvas = {
    height,
    pixels: new Uint8Array(width * height * 4),
    width,
  };

  fillRect(canvas, 0, 0, width, height, colour);

  return canvas;
}

function parseHexColour(value: string | undefined, fallback: Rgba): Rgba {
  if (!value || value.startsWith('scheme:') || value.startsWith('preset:')) {
    return fallback;
  }

  const hex = value.replace(/^#/, '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallback;
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    fallback[3],
  ];
}

function fillColour(fill: FillStyle | undefined, fallback: Rgba): Rgba {
  if (!fill || fill.kind !== 'solid') {
    return fallback;
  }

  const colour = parseHexColour(fill.colour, fallback);
  return [colour[0], colour[1], colour[2], Math.round((fill.alpha ?? 1) * 255)];
}

function strokeColour(stroke: StrokeStyle | undefined): Rgba {
  return parseHexColour(stroke?.colour, BLACK);
}

function blendPixel(canvas: Canvas, x: number, y: number, colour: Rgba): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || colour[3] <= 0) {
    return;
  }

  const offset = (Math.trunc(y) * canvas.width + Math.trunc(x)) * 4;
  const sourceAlpha = colour[3] / 255;
  const inverseSourceAlpha = 1 - sourceAlpha;

  canvas.pixels[offset] = Math.round(
    colour[0] * sourceAlpha + canvas.pixels[offset] * inverseSourceAlpha,
  );
  canvas.pixels[offset + 1] = Math.round(
    colour[1] * sourceAlpha + canvas.pixels[offset + 1] * inverseSourceAlpha,
  );
  canvas.pixels[offset + 2] = Math.round(
    colour[2] * sourceAlpha + canvas.pixels[offset + 2] * inverseSourceAlpha,
  );
  canvas.pixels[offset + 3] = 255;
}

function fillRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: Rgba,
) {
  const startX = clamp(Math.floor(x), 0, canvas.width);
  const endX = clamp(Math.ceil(x + width), 0, canvas.width);
  const startY = clamp(Math.floor(y), 0, canvas.height);
  const endY = clamp(Math.ceil(y + height), 0, canvas.height);

  for (let pixelY = startY; pixelY < endY; pixelY += 1) {
    for (let pixelX = startX; pixelX < endX; pixelX += 1) {
      blendPixel(canvas, pixelX, pixelY, colour);
    }
  }
}

function strokeRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  colour: Rgba,
): void {
  const lineWidth = Math.max(1, Math.round(thickness));
  fillRect(canvas, x, y, width, lineWidth, colour);
  fillRect(canvas, x, y + height - lineWidth, width, lineWidth, colour);
  fillRect(canvas, x, y, lineWidth, height, colour);
  fillRect(canvas, x + width - lineWidth, y, lineWidth, height, colour);
}

function fillEllipse(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: Rgba,
): void {
  const radiusX = width / 2;
  const radiusY = height / 2;
  const centerX = x + radiusX;
  const centerY = y + radiusY;
  const startX = Math.floor(x);
  const endX = Math.ceil(x + width);
  const startY = Math.floor(y);
  const endY = Math.ceil(y + height);

  for (let pixelY = startY; pixelY < endY; pixelY += 1) {
    for (let pixelX = startX; pixelX < endX; pixelX += 1) {
      const normalizedX = (pixelX + 0.5 - centerX) / radiusX;
      const normalizedY = (pixelY + 0.5 - centerY) / radiusY;

      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        blendPixel(canvas, pixelX, pixelY, colour);
      }
    }
  }
}

function strokeEllipse(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  colour: Rgba,
): void {
  const radiusX = width / 2;
  const radiusY = height / 2;
  const centerX = x + radiusX;
  const centerY = y + radiusY;
  const threshold = Math.max(0.01, thickness / Math.max(width, height));

  for (let pixelY = Math.floor(y); pixelY < Math.ceil(y + height); pixelY += 1) {
    for (let pixelX = Math.floor(x); pixelX < Math.ceil(x + width); pixelX += 1) {
      const normalizedX = (pixelX + 0.5 - centerX) / radiusX;
      const normalizedY = (pixelY + 0.5 - centerY) / radiusY;
      const distance = normalizedX * normalizedX + normalizedY * normalizedY;

      if (distance <= 1 && distance >= 1 - threshold) {
        blendPixel(canvas, pixelX, pixelY, colour);
      }
    }
  }
}

function fillGradientRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Extract<FillStyle, { kind: 'gradient' }>,
): void {
  const stops = fill.stops
    .map((stop) => ({
      colour: parseHexColour(stop.colour, WHITE),
      position: clamp(stop.position, 0, 1),
    }))
    .sort((left, right) => left.position - right.position);

  if (stops.length === 0) {
    return;
  }

  for (let pixelY = Math.floor(y); pixelY < Math.ceil(y + height); pixelY += 1) {
    const progress = height <= 1 ? 0 : clamp((pixelY - y) / height, 0, 1);
    const nextStopIndex = stops.findIndex((stop) => stop.position >= progress);
    const nextStop = stops[nextStopIndex === -1 ? stops.length - 1 : nextStopIndex];
    const previousStop =
      stops[Math.max(0, (nextStopIndex === -1 ? stops.length : nextStopIndex) - 1)];
    const localProgress =
      nextStop.position === previousStop.position
        ? 0
        : (progress - previousStop.position) / (nextStop.position - previousStop.position);
    const colour: Rgba = [
      Math.round(
        previousStop.colour[0] + (nextStop.colour[0] - previousStop.colour[0]) * localProgress,
      ),
      Math.round(
        previousStop.colour[1] + (nextStop.colour[1] - previousStop.colour[1]) * localProgress,
      ),
      Math.round(
        previousStop.colour[2] + (nextStop.colour[2] - previousStop.colour[2]) * localProgress,
      ),
      255,
    ];

    fillRect(canvas, x, pixelY, width, 1, colour);
  }
}

function fillCircle(
  canvas: Canvas,
  centerX: number,
  centerY: number,
  radius: number,
  colour: Rgba,
) {
  const startX = Math.floor(centerX - radius);
  const endX = Math.ceil(centerX + radius);
  const startY = Math.floor(centerY - radius);
  const endY = Math.ceil(centerY + radius);
  const squaredRadius = radius * radius;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distanceX = x - centerX;
      const distanceY = y - centerY;

      if (distanceX * distanceX + distanceY * distanceY <= squaredRadius) {
        blendPixel(canvas, x, y, colour);
      }
    }
  }
}

function drawLine(
  canvas: Canvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  colour: Rgba,
): void {
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY), 1);
  const radius = Math.max(0.5, thickness / 2);

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    fillCircle(
      canvas,
      startX + (endX - startX) * progress,
      startY + (endY - startY) * progress,
      radius,
      colour,
    );
  }
}

function parseJsonStyle<T>(json: string | null): T | undefined {
  if (!json) {
    return undefined;
  }

  return JSON.parse(json) as T;
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

function getSlideRow(database: AppDatabase, slideId: number): SlideRow | undefined {
  return database
    .prepare(
      `
        SELECT id, presentation_id, slide_order, width_emu, height_emu, background_json
        FROM slides
        WHERE id = ?
      `,
    )
    .get(slideId) as SlideRow | undefined;
}

function shapeRows(database: AppDatabase, slideId: number): ShapeRow[] {
  return database
    .prepare(
      `
        SELECT
          id,
          shape_order,
          kind,
          preset,
          x_emu,
          y_emu,
          width_emu,
          height_emu,
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

function emuToPixels(value: number | null | undefined, scale: number): number {
  return Math.round((value ?? 0) * scale);
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

function renderBackground(
  canvas: Canvas,
  fill: FillStyle | undefined,
  mediaByRelationship: Map<string, MediaRow>,
): void {
  if (!fill || fill.kind === 'none') {
    fillRect(canvas, 0, 0, canvas.width, canvas.height, WHITE);
    return;
  }

  if (fill.kind === 'solid') {
    fillRect(canvas, 0, 0, canvas.width, canvas.height, fillColour(fill, WHITE));
    return;
  }

  if (fill.kind === 'gradient') {
    fillGradientRect(canvas, 0, 0, canvas.width, canvas.height, fill);
    return;
  }

  if (fill.kind === 'image') {
    const media = fill.relationshipId ? mediaByRelationship.get(fill.relationshipId) : undefined;

    if (media?.content_type === 'image/png') {
      try {
        compositePng(canvas, decodePng(media.data), 0, 0, canvas.width, canvas.height);
        return;
      } catch {
        fillRect(canvas, 0, 0, canvas.width, canvas.height, WHITE);
        return;
      }
    }
  }

  fillRect(canvas, 0, 0, canvas.width, canvas.height, WHITE);
}

function drawShapeFill(
  canvas: Canvas,
  shape: ShapeRow,
  fill: FillStyle | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (!fill || fill.kind === 'none' || fill.kind === 'image') {
    return;
  }

  if (fill.kind === 'gradient') {
    fillGradientRect(canvas, x, y, width, height, fill);
    return;
  }

  const colour = fillColour(fill, TRANSPARENT);

  if (colour[3] === 0) {
    return;
  }

  if (shape.preset === 'ellipse') {
    fillEllipse(canvas, x, y, width, height, colour);
  } else {
    fillRect(canvas, x, y, width, height, colour);
  }
}

function drawShapeStroke(
  canvas: Canvas,
  shape: ShapeRow,
  stroke: StrokeStyle | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): void {
  if (!stroke) {
    return;
  }

  const thickness = Math.max(1, emuToPixels(stroke.widthEmu ?? 9_525, scale));
  const colour = strokeColour(stroke);

  if (shape.kind === 'connector' || shape.preset === 'line') {
    drawLine(canvas, x, y, x + width, y + height, thickness, colour);
    return;
  }

  if (shape.preset === 'ellipse') {
    strokeEllipse(canvas, x, y, width, height, thickness, colour);
  } else {
    strokeRect(canvas, x, y, width, height, thickness, colour);
  }
}

function compositePng(
  canvas: Canvas,
  image: DecodedPng,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
): void {
  if (targetWidth <= 0 || targetHeight <= 0) {
    return;
  }

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = clamp(Math.floor((y / targetHeight) * image.height), 0, image.height - 1);

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = clamp(Math.floor((x / targetWidth) * image.width), 0, image.width - 1);
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const colour: Rgba = [
        image.pixels[sourceOffset],
        image.pixels[sourceOffset + 1],
        image.pixels[sourceOffset + 2],
        image.pixels[sourceOffset + 3],
      ];

      blendPixel(canvas, targetX + x, targetY + y, colour);
    }
  }
}

function drawImagePlaceholder(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  dpi: number,
): void {
  fillRect(canvas, x, y, width, height, PLACEHOLDER_FILL);
  strokeRect(canvas, x, y, width, height, Math.max(1, Math.round(dpi / 96)), PLACEHOLDER_STROKE);
  renderText(
    canvas,
    [
      {
        bold: false,
        content: 'Image',
        italic: false,
      },
    ],
    x,
    y,
    width,
    height,
    dpi,
  );
}

function drawImageShape(
  canvas: Canvas,
  shape: ShapeRow,
  mediaByRelationship: Map<string, MediaRow>,
  x: number,
  y: number,
  width: number,
  height: number,
  dpi: number,
): void {
  const relationshipId = shape.media_relationship_id;
  const media = relationshipId ? mediaByRelationship.get(relationshipId) : undefined;

  if (!media || media.content_type !== 'image/png') {
    drawImagePlaceholder(canvas, x, y, width, height, dpi);
    return;
  }

  try {
    compositePng(canvas, decodePng(media.data), x, y, width, height);
  } catch {
    drawImagePlaceholder(canvas, x, y, width, height, dpi);
  }
}

function styleFromRun(run: TextRun | undefined): TextStyle {
  return {
    alignment: run?.alignment,
    bold: run?.bold ?? false,
    colour: parseHexColour(run?.colour, BLACK),
    fontFamily: run?.fontFamily,
    fontSizePt: run?.fontSizePt ?? 18,
    italic: run?.italic ?? false,
  };
}

function glyphFor(character: string): readonly string[] {
  const normalized = character.toUpperCase();
  return GLYPHS[normalized] ?? ['11111', '10001', '00010', '00100', '00000', '00100', '00000'];
}

function glyphScale(style: TextStyle, dpi: number): number {
  const fontPx = Math.max(8, (style.fontSizePt * dpi) / 72);
  return Math.max(1, Math.round(fontPx / 8));
}

function measureText(text: string, style: TextStyle, dpi: number): number {
  const scale = glyphScale(style, dpi);

  return [...text].reduce((width, character) => {
    const glyph = glyphFor(character);
    const glyphWidth = Math.max(...glyph.map((row) => row.length));
    return width + (glyphWidth + 1 + (style.bold ? 1 : 0)) * scale;
  }, 0);
}

function wrapText(text: string, maxWidth: number, style: TextStyle, dpi: number): string[] {
  const sourceLines = text.split('\n');
  const lines: string[] = [];

  for (const sourceLine of sourceLines) {
    const words = sourceLine.split(/(\s+)/).filter((word) => word.length > 0);
    let line = '';

    for (const word of words) {
      const nextLine = `${line}${word}`;

      if (line.length > 0 && measureText(nextLine.trimEnd(), style, dpi) > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = nextLine;
      }
    }

    lines.push(line.trimEnd());
  }

  return lines.filter((line, index) => line.length > 0 || index === 0);
}

function drawGlyph(
  canvas: Canvas,
  character: string,
  x: number,
  y: number,
  scale: number,
  style: TextStyle,
): number {
  const glyph = glyphFor(character);
  const slant = style.italic ? Math.max(1, Math.floor(scale / 2)) : 0;

  glyph.forEach((row, rowIndex) => {
    const rowSlant =
      slant === 0 ? 0 : Math.floor(((glyph.length - rowIndex) / glyph.length) * slant);

    [...row].forEach((cell, columnIndex) => {
      if (cell !== '1') {
        return;
      }

      const pixelX = x + columnIndex * scale + rowSlant;
      const pixelY = y + rowIndex * scale;
      fillRect(canvas, pixelX, pixelY, scale, scale, style.colour);

      if (style.bold) {
        fillRect(
          canvas,
          pixelX + scale,
          pixelY,
          Math.max(1, Math.floor(scale / 2)),
          scale,
          style.colour,
        );
      }
    });
  });

  return (Math.max(...glyph.map((row) => row.length)) + 1 + (style.bold ? 1 : 0)) * scale;
}

function drawTextLine(
  canvas: Canvas,
  line: string,
  x: number,
  y: number,
  style: TextStyle,
  dpi: number,
): void {
  let cursorX = x;
  const scale = glyphScale(style, dpi);

  for (const character of line) {
    cursorX += drawGlyph(canvas, character, cursorX, y, scale, style);
  }
}

function renderText(
  canvas: Canvas,
  runs: TextRun[],
  x: number,
  y: number,
  width: number,
  height: number,
  dpi: number,
): void {
  if (runs.length === 0 || width <= 0 || height <= 0) {
    return;
  }

  const style = styleFromRun(runs[0]);
  const scale = glyphScale(style, dpi);
  const lineHeight = Math.round(9 * scale);
  const horizontalPadding = Math.min(Math.max(6, Math.round(width * 0.04)), Math.max(6, width / 4));
  const verticalPadding = Math.min(Math.max(6, Math.round(height * 0.08)), Math.max(6, height / 4));
  const usableWidth = Math.max(1, width - horizontalPadding * 2);
  const text = runs.map((run) => run.content).join('');
  const lines = wrapText(text, usableWidth, style, dpi);
  const visibleLineCount = Math.max(
    1,
    Math.min(lines.length, Math.floor((height - verticalPadding * 2) / lineHeight)),
  );
  const totalTextHeight = visibleLineCount * lineHeight;
  const startY = Math.round(y + Math.max(verticalPadding, (height - totalTextHeight) / 2));

  lines.slice(0, visibleLineCount).forEach((line, lineIndex) => {
    const measuredWidth = measureText(line, style, dpi);
    const alignment = style.alignment;
    let lineX = x + horizontalPadding;

    if (alignment === 'ctr' || alignment === 'center') {
      lineX = x + Math.max(horizontalPadding, (width - measuredWidth) / 2);
    } else if (alignment === 'r' || alignment === 'right') {
      lineX = x + width - horizontalPadding - measuredWidth;
    }

    drawTextLine(canvas, line, Math.round(lineX), startY + lineIndex * lineHeight, style, dpi);
  });
}

function renderShape(
  canvas: Canvas,
  shape: ShapeRow,
  runs: TextRun[],
  mediaByRelationship: Map<string, MediaRow>,
  scaleX: number,
  scaleY: number,
  dpi: number,
): void {
  const x = emuToPixels(shape.x_emu, scaleX);
  const y = emuToPixels(shape.y_emu, scaleY);
  const width = Math.max(0, emuToPixels(shape.width_emu, scaleX));
  const height = Math.max(0, emuToPixels(shape.height_emu, scaleY));

  if (width <= 0 || height <= 0) {
    return;
  }

  const fill = parseJsonStyle<FillStyle>(shape.fill_json);
  const stroke = parseJsonStyle<StrokeStyle>(shape.stroke_json);

  if (shape.kind === 'image') {
    drawImageShape(canvas, shape, mediaByRelationship, x, y, width, height, dpi);
  } else {
    drawShapeFill(canvas, shape, fill, x, y, width, height);
    drawShapeStroke(canvas, shape, stroke, x, y, width, height, (scaleX + scaleY) / 2);
  }

  renderText(canvas, runs, x, y, width, height, dpi);
}

function toRenderedImage(
  slide: SlideRow,
  canvas: Canvas,
  renderError?: string,
): RenderedSlideImage {
  return {
    data: encodeRgbaPng(canvas.width, canvas.height, canvas.pixels),
    heightPx: canvas.height,
    presentationId: slide.presentation_id,
    renderError,
    slideId: slide.id,
    slideOrder: slide.slide_order,
    widthPx: canvas.width,
  };
}

function renderPlaceholderSlide(
  slide: SlideRow,
  message: string,
  options: RenderOptions = {},
): RenderedSlideImage {
  const { heightPx, widthPx } = slideOutputSize(slide, options.widthPx);
  const canvas = createCanvas(widthPx, heightPx, [255, 243, 241, 255]);
  const dpi = EMU_PER_INCH * (widthPx / Math.max(1, slide.width_emu));

  strokeRect(
    canvas,
    0,
    0,
    widthPx,
    heightPx,
    Math.max(2, Math.round(widthPx / 260)),
    [180, 35, 24, 255],
  );
  renderText(
    canvas,
    [
      {
        bold: true,
        colour: '#7A271A',
        content: message,
        italic: false,
      },
    ],
    0,
    0,
    widthPx,
    heightPx,
    dpi,
  );

  return toRenderedImage(slide, canvas, message);
}

export function renderSlideToImage(
  database: AppDatabase,
  slideId: number,
  options: RenderOptions = {},
): RenderedSlideImage {
  const slide = getSlideRow(database, slideId);

  if (!slide) {
    throw new Error(`Slide ${slideId} was not found.`);
  }

  const { heightPx, widthPx } = slideOutputSize(slide, options.widthPx);
  const slideWidthEmu = slide.width_emu > 0 ? slide.width_emu : FALLBACK_SLIDE_WIDTH_EMU;
  const slideHeightEmu = slide.height_emu > 0 ? slide.height_emu : FALLBACK_SLIDE_HEIGHT_EMU;
  const scaleX = widthPx / slideWidthEmu;
  const scaleY = heightPx / slideHeightEmu;
  const dpi = EMU_PER_INCH * scaleX;
  const canvas = createCanvas(widthPx, heightPx);
  const background = parseJsonStyle<FillStyle>(slide.background_json);
  const runsByShape = textRunsByShape(database, slideId);
  const mediaByRelationship = mediaRowsByRelationship(database, slideId);

  renderBackground(canvas, background, mediaByRelationship);

  for (const shape of shapeRows(database, slideId)) {
    renderShape(
      canvas,
      shape,
      runsByShape.get(shape.id) ?? [],
      mediaByRelationship,
      scaleX,
      scaleY,
      dpi,
    );
  }

  return toRenderedImage(slide, canvas);
}

export function storeSlideImage(database: AppDatabase, image: RenderedSlideImage): void {
  database
    .prepare(
      `
        INSERT INTO slide_images (
          slide_id,
          presentation_id,
          slide_order,
          width_px,
          height_px,
          image_format,
          data,
          render_error
        )
        VALUES (
          @slideId,
          @presentationId,
          @slideOrder,
          @widthPx,
          @heightPx,
          'png',
          @data,
          @renderError
        )
        ON CONFLICT(slide_id) DO UPDATE SET
          presentation_id = excluded.presentation_id,
          slide_order = excluded.slide_order,
          width_px = excluded.width_px,
          height_px = excluded.height_px,
          image_format = excluded.image_format,
          data = excluded.data,
          render_error = excluded.render_error,
          created_at = CURRENT_TIMESTAMP
      `,
    )
    .run({
      data: image.data,
      heightPx: image.heightPx,
      presentationId: image.presentationId,
      renderError: image.renderError ?? null,
      slideId: image.slideId,
      slideOrder: image.slideOrder,
      widthPx: image.widthPx,
    });
}

function getStoredSlideImageBySlideId(
  database: AppDatabase,
  slideId: number,
): StoredSlideImage | undefined {
  const row = database
    .prepare(
      `
        SELECT
          slide_id AS slideId,
          presentation_id AS presentationId,
          slide_order AS slideOrder,
          width_px AS widthPx,
          height_px AS heightPx,
          data,
          render_error AS renderError
        FROM slide_images
        WHERE slide_id = ?
      `,
    )
    .get(slideId) as StoredSlideImage | undefined;

  return row;
}

export function getStoredSlideImage(
  database: AppDatabase,
  presentationId: number,
  slideOrder: number,
): StoredSlideImage | undefined {
  return database
    .prepare(
      `
        SELECT
          slide_id AS slideId,
          presentation_id AS presentationId,
          slide_order AS slideOrder,
          width_px AS widthPx,
          height_px AS heightPx,
          data,
          render_error AS renderError
        FROM slide_images
        WHERE presentation_id = ? AND slide_order = ?
      `,
    )
    .get(presentationId, slideOrder) as StoredSlideImage | undefined;
}

export function ensureStoredSlideImage(
  database: AppDatabase,
  presentationId: number,
  slideOrder: number,
  options: RenderOptions = {},
): StoredSlideImage | undefined {
  const storedImage = getStoredSlideImage(database, presentationId, slideOrder);

  if (storedImage) {
    return storedImage;
  }

  const slide = database
    .prepare(
      `
        SELECT id, presentation_id, slide_order, width_emu, height_emu, background_json
        FROM slides
        WHERE presentation_id = ? AND slide_order = ?
      `,
    )
    .get(presentationId, slideOrder) as SlideRow | undefined;

  if (!slide) {
    return undefined;
  }

  return renderAndStoreSlideImage(database, slide.id, options);
}

export function renderAndStoreSlideImage(
  database: AppDatabase,
  slideId: number,
  options: RenderOptions = {},
): StoredSlideImage {
  const slide = getSlideRow(database, slideId);

  if (!slide) {
    throw new Error(`Slide ${slideId} was not found.`);
  }

  let image: RenderedSlideImage;

  try {
    image = renderSlideToImage(database, slideId, options);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Slide could not be rendered.';
    image = renderPlaceholderSlide(slide, message, options);
  }

  storeSlideImage(database, image);

  return getStoredSlideImageBySlideId(database, slideId) ?? image;
}

export function renderAndStorePresentationSlides(
  database: AppDatabase,
  presentationId: number,
  options: RenderPresentationOptions = {},
): { failed: number; rendered: number } {
  const slides = slideRows(database, presentationId);
  let failed = 0;
  let rendered = 0;

  slides.forEach((slide, index) => {
    const image = renderAndStoreSlideImage(database, slide.id, options);

    if (image.renderError) {
      failed += 1;
    }

    rendered += 1;
    options.onProgress?.({
      slideCount: slides.length,
      slideIndex: index + 1,
    });
  });

  return { failed, rendered };
}
