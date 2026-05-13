import type { AppDatabase } from './database';

type SlideRow = {
  id: number;
  presentation_id: number;
  slide_order: number;
};

type SlideNoteRow = {
  content_json: string;
  plain_text: string;
  presentation_id: number;
  slide_id: number;
  slide_order?: number;
  updated_at: string;
};

type RunResult = {
  changes: number;
};

export type NotesContentJson = Record<string, unknown>;

export type NotesSlideContext = {
  presentationId: number;
  slideId: number;
  slideOrder: number;
  title: string;
};

export type SlideNote = {
  contentJson: NotesContentJson;
  plainText: string;
  presentationId: number;
  slideId: number;
  slideOrder?: number;
  updatedAt?: string;
};

export type GetSlideNoteResponse =
  | {
      found: true;
      note: SlideNote;
    }
  | {
      error: string;
      found: false;
    };

export type SaveSlideNoteResponse =
  | {
      note: SlideNote;
      saved: true;
    }
  | {
      error: string;
      saved: false;
    };

export type GetPresentationNotesResponse =
  | {
      found: true;
      notes: SlideNote[];
    }
  | {
      error: string;
      found: false;
    };

export function getNotes(database: AppDatabase, request: unknown): GetSlideNoteResponse {
  if (!isPositiveInteger(request)) {
    return {
      error: 'The notes request was invalid.',
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
          content_json,
          plain_text,
          presentation_id,
          slide_id,
          updated_at
        FROM slide_notes
        WHERE slide_id = ?
      `,
    )
    .get(request) as SlideNoteRow | undefined;

  return {
    found: true,
    note: row
      ? rowToSlideNote(row, slide.slide_order)
      : {
          contentJson: {},
          plainText: '',
          presentationId: slide.presentation_id,
          slideId: slide.id,
          slideOrder: slide.slide_order,
        },
  };
}

export function saveNotes(database: AppDatabase, request: unknown): SaveSlideNoteResponse {
  if (!isSaveSlideNoteRequest(request)) {
    return {
      error: 'The notes save request was invalid.',
      saved: false,
    };
  }

  const contentJson = JSON.stringify(request.contentJson);
  const result = database
    .prepare(
      `
        INSERT INTO slide_notes (
          slide_id,
          presentation_id,
          content_json,
          plain_text,
          updated_at
        )
        SELECT
          id,
          presentation_id,
          @contentJson,
          @plainText,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        FROM slides
        WHERE id = @slideId
        ON CONFLICT(slide_id) DO UPDATE SET
          presentation_id = excluded.presentation_id,
          content_json = excluded.content_json,
          plain_text = excluded.plain_text,
          updated_at = excluded.updated_at
      `,
    )
    .run({
      contentJson,
      plainText: request.plainText,
      slideId: request.slideId,
    }) as RunResult;

  if (result.changes === 0) {
    return {
      error: 'The requested slide was not found.',
      saved: false,
    };
  }

  const response = getNotes(database, request.slideId);

  if (!response.found) {
    return {
      error: response.error,
      saved: false,
    };
  }

  return {
    note: response.note,
    saved: true,
  };
}

export function getNotesForPresentation(
  database: AppDatabase,
  request: unknown,
): GetPresentationNotesResponse {
  if (!isPositiveInteger(request)) {
    return {
      error: 'The presentation notes request was invalid.',
      found: false,
    };
  }

  const presentation = database
    .prepare('SELECT id FROM presentations WHERE id = ?')
    .get(request) as { id: number } | undefined;

  if (!presentation) {
    return {
      error: 'The requested presentation was not found.',
      found: false,
    };
  }

  const rows = database
    .prepare(
      `
        SELECT
          COALESCE(slide_notes.content_json, '{}') AS content_json,
          COALESCE(slide_notes.plain_text, '') AS plain_text,
          slides.presentation_id,
          slides.id AS slide_id,
          slides.slide_order,
          slide_notes.updated_at
        FROM slides
        LEFT JOIN slide_notes ON slide_notes.slide_id = slides.id
        WHERE slides.presentation_id = ?
        ORDER BY slides.slide_order
      `,
    )
    .all(request) as SlideNoteRow[];

  return {
    found: true,
    notes: rows.map((row) => rowToSlideNote(row, row.slide_order)),
  };
}

function findSlide(database: AppDatabase, slideId: number): SlideRow | undefined {
  return database
    .prepare(
      `
        SELECT id, presentation_id, slide_order
        FROM slides
        WHERE id = ?
      `,
    )
    .get(slideId) as SlideRow | undefined;
}

function rowToSlideNote(row: SlideNoteRow, slideOrder: number | undefined): SlideNote {
  return {
    contentJson: parseContentJson(row.content_json),
    plainText: row.plain_text,
    presentationId: row.presentation_id,
    slideId: row.slide_id,
    ...(slideOrder === undefined ? {} : { slideOrder }),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

function parseContentJson(value: string): NotesContentJson {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as NotesContentJson)
      : {};
  } catch {
    return {};
  }
}

function isSaveSlideNoteRequest(value: unknown): value is {
  contentJson: NotesContentJson;
  plainText: string;
  slideId: number;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<{
    contentJson: unknown;
    plainText: unknown;
    slideId: unknown;
  }>;

  return (
    isPositiveInteger(request.slideId) &&
    isPlainObject(request.contentJson) &&
    typeof request.plainText === 'string'
  );
}

function isPlainObject(value: unknown): value is NotesContentJson {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
