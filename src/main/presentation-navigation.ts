import type { AppDatabase } from './database';
import { ensureStoredSlideImage } from './rasterizer';

const THUMBNAIL_WIDTH_PX = 240;

type SlideListRow = {
  hidden: 0 | 1;
  id: number;
  slide_order: number;
};

type PresentationRow = {
  id: number;
};

type SlideHiddenRow = {
  hidden: 0 | 1;
};

export type PresentationSlideListItem = {
  hidden: boolean;
  renderError?: string;
  slideId: number;
  slideOrder: number;
  thumbnailDataUrl: string;
};

export type PresentationSlideListResponse =
  | {
      found: true;
      slides: PresentationSlideListItem[];
    }
  | {
      error: string;
      found: false;
    };

export type ToggleSlideHiddenRequest = {
  presentationId: number;
  slideOrder: number;
};

export type ToggleSlideHiddenResponse =
  | {
      found: true;
      hidden: boolean;
    }
  | {
      error: string;
      found: false;
    };

export function getSlideList(
  database: AppDatabase,
  request: unknown,
): PresentationSlideListResponse {
  if (!isPositiveInteger(request)) {
    return {
      error: 'The slide list request was invalid.',
      found: false,
    };
  }

  const presentation = database
    .prepare('SELECT id FROM presentations WHERE id = ?')
    .get(request) as PresentationRow | undefined;

  if (!presentation) {
    return {
      error: 'The requested presentation was not found.',
      found: false,
    };
  }

  const rows = database
    .prepare(
      `
        SELECT id, slide_order, hidden
        FROM slides
        WHERE presentation_id = ?
        ORDER BY slide_order
      `,
    )
    .all(request) as SlideListRow[];

  const slides = rows.map((row) => {
    const image = ensureStoredSlideImage(database, request, row.slide_order, {
      widthPx: THUMBNAIL_WIDTH_PX,
    });

    return {
      hidden: row.hidden === 1,
      ...(image?.renderError ? { renderError: image.renderError } : {}),
      slideId: row.id,
      slideOrder: row.slide_order,
      thumbnailDataUrl: image ? toPngDataUrl(image.data) : '',
    };
  });

  return {
    found: true,
    slides,
  };
}

export function toggleSlideHidden(
  database: AppDatabase,
  request: unknown,
): ToggleSlideHiddenResponse {
  if (!isToggleSlideHiddenRequest(request)) {
    return {
      error: 'The slide visibility request was invalid.',
      found: false,
    };
  }

  const row = database
    .prepare(
      `
        SELECT hidden
        FROM slides
        WHERE presentation_id = ? AND slide_order = ?
      `,
    )
    .get(request.presentationId, request.slideOrder) as SlideHiddenRow | undefined;

  if (!row) {
    return {
      error: 'The requested slide was not found.',
      found: false,
    };
  }

  const hidden = row.hidden === 0;

  database
    .prepare(
      `
        UPDATE slides
        SET hidden = ?
        WHERE presentation_id = ? AND slide_order = ?
      `,
    )
    .run(hidden ? 1 : 0, request.presentationId, request.slideOrder);

  return {
    found: true,
    hidden,
  };
}

function toPngDataUrl(data: Buffer): string {
  return `data:image/png;base64,${Buffer.from(data).toString('base64')}`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isToggleSlideHiddenRequest(value: unknown): value is ToggleSlideHiddenRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<Record<keyof ToggleSlideHiddenRequest, unknown>>;

  return isPositiveInteger(request.presentationId) && isSlideOrder(request.slideOrder);
}

function isSlideOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
