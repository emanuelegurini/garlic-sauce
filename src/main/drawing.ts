import type { AppDatabase } from './database';

type SlideRow = {
  id: number;
  presentation_id: number;
};

type SlideDrawingRow = {
  canvas_data: Buffer;
  presentation_id: number;
  slide_id: number;
  updated_at: string;
};

type RunResult = {
  changes: number;
};

export type SlideDrawing = {
  canvasData: string;
  presentationId: number;
  slideId: number;
  updatedAt: string;
};

export type GetSlideDrawingResponse =
  | {
      drawing: SlideDrawing | null;
      found: true;
    }
  | {
      error: string;
      found: false;
    };

export type SaveSlideDrawingResponse =
  | {
      drawing: SlideDrawing;
      saved: true;
    }
  | {
      error: string;
      saved: false;
    };

export type ClearSlideDrawingResponse =
  | {
      cleared: true;
    }
  | {
      cleared: false;
      error: string;
    };

export function getDrawing(database: AppDatabase, request: unknown): GetSlideDrawingResponse {
  if (!isPositiveInteger(request)) {
    return {
      error: 'The drawing request was invalid.',
      found: false,
    };
  }

  const slide = findSlide(database, request);

  if (!slide) {
    return {
      error: 'The requested slide was not found.',
      found: false,
    };
  }

  const row = database
    .prepare(
      `
        SELECT
          canvas_data,
          presentation_id,
          slide_id,
          updated_at
        FROM slide_drawings
        WHERE slide_id = ?
      `,
    )
    .get(request) as SlideDrawingRow | undefined;

  return {
    drawing: row ? rowToSlideDrawing(row) : null,
    found: true,
  };
}

export function saveDrawing(database: AppDatabase, request: unknown): SaveSlideDrawingResponse {
  if (!isSaveDrawingRequest(request)) {
    return {
      error: 'The drawing save request was invalid.',
      saved: false,
    };
  }

  const canvasData = pngDataUrlToBuffer(request.canvasData);

  if (!canvasData) {
    return {
      error: 'The drawing canvas data was invalid.',
      saved: false,
    };
  }

  const result = database
    .prepare(
      `
        INSERT INTO slide_drawings (
          slide_id,
          presentation_id,
          canvas_data,
          updated_at
        )
        SELECT
          id,
          presentation_id,
          @canvasData,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        FROM slides
        WHERE id = @slideId
        ON CONFLICT(slide_id) DO UPDATE SET
          presentation_id = excluded.presentation_id,
          canvas_data = excluded.canvas_data,
          updated_at = excluded.updated_at
      `,
    )
    .run({
      canvasData,
      slideId: request.slideId,
    }) as RunResult;

  if (result.changes === 0) {
    return {
      error: 'The requested slide was not found.',
      saved: false,
    };
  }

  const response = getDrawing(database, request.slideId);

  if (!response.found || !response.drawing) {
    return {
      error: response.found ? 'The saved drawing could not be read.' : response.error,
      saved: false,
    };
  }

  return {
    drawing: response.drawing,
    saved: true,
  };
}

export function clearDrawing(database: AppDatabase, request: unknown): ClearSlideDrawingResponse {
  if (!isPositiveInteger(request)) {
    return {
      cleared: false,
      error: 'The drawing clear request was invalid.',
    };
  }

  const slide = findSlide(database, request);

  if (!slide) {
    return {
      cleared: false,
      error: 'The requested slide was not found.',
    };
  }

  database.prepare('DELETE FROM slide_drawings WHERE slide_id = ?').run(request);

  return {
    cleared: true,
  };
}

function findSlide(database: AppDatabase, slideId: number): SlideRow | undefined {
  return database
    .prepare(
      `
        SELECT id, presentation_id
        FROM slides
        WHERE id = ?
      `,
    )
    .get(slideId) as SlideRow | undefined;
}

function rowToSlideDrawing(row: SlideDrawingRow): SlideDrawing {
  return {
    canvasData: bufferToPngDataUrl(row.canvas_data),
    presentationId: row.presentation_id,
    slideId: row.slide_id,
    updatedAt: row.updated_at,
  };
}

function bufferToPngDataUrl(data: Buffer): string {
  return `data:image/png;base64,${Buffer.from(data).toString('base64')}`;
}

function pngDataUrlToBuffer(canvasData: string): Buffer | null {
  const match = canvasData.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return null;
  }

  const buffer = Buffer.from(match[1], 'base64');

  return hasPngSignature(buffer) ? buffer : null;
}

function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isSaveDrawingRequest(value: unknown): value is {
  canvasData: string;
  slideId: number;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<{ canvasData: unknown; slideId: unknown }>;

  return isPositiveInteger(request.slideId) && typeof request.canvasData === 'string';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
