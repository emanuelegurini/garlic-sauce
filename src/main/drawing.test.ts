import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from './database';
import { clearDrawing, getDrawing, saveDrawing } from './drawing';

const transparentPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lJ5nWQAAAABJRU5ErkJggg==';
const redPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFAgH/ahW8LwAAAABJRU5ErkJggg==';

let database: AppDatabase | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

function insertPresentation(): number {
  const result = database
    ?.prepare(
      `
        INSERT INTO presentations (
          source_path,
          source_format,
          title,
          slide_width_emu,
          slide_height_emu
        )
        VALUES ('/tmp/drawing.pptx', 'pptx', 'Drawing Deck', 914400, 914400)
      `,
    )
    .run();

  return Number(result?.lastInsertRowid);
}

function insertSlide(presentationId: number, slideOrder: number): number {
  const result = database
    ?.prepare(
      `
        INSERT INTO slides (
          presentation_id,
          slide_order,
          source_id,
          width_emu,
          height_emu
        )
        VALUES (?, ?, ?, 914400, 914400)
      `,
    )
    .run(presentationId, slideOrder, `slide${slideOrder + 1}.xml`);

  return Number(result?.lastInsertRowid);
}

describe('slide drawing persistence helpers', () => {
  it('creates the slide_drawings table and presentation/slide index', () => {
    database = openDatabase(':memory:');

    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'slide_drawings'")
        .get(),
    ).toEqual({ name: 'slide_drawings' });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_slide_drawings_presentation_slide'",
        )
        .get(),
    ).toEqual({ name: 'idx_slide_drawings_presentation_slide' });
  });

  it('reads null drawings, upserts canvas data, clears rows, and cascades deletes', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(presentationId, 0);

    expect(getDrawing(database, slideId)).toEqual({
      drawing: null,
      found: true,
    });

    expect(
      saveDrawing(database, {
        canvasData: transparentPngDataUrl,
        elementsJson: [
          {
            colour: '#ff0000',
            height: 40,
            id: 'shape-1',
            lineWidth: 3,
            tool: 'rectangle',
            type: 'shape',
            width: 80,
            x: 10,
            y: 20,
          },
        ],
        slideId,
      }),
    ).toMatchObject({
      drawing: {
        canvasData: transparentPngDataUrl,
        elementsJson: [
          {
            id: 'shape-1',
            tool: 'rectangle',
            type: 'shape',
          },
        ],
        presentationId,
        slideId,
      },
      saved: true,
    });

    expect(
      saveDrawing(database, {
        canvasData: redPngDataUrl,
        elementsJson: [],
        slideId,
      }),
    ).toMatchObject({
      drawing: {
        canvasData: redPngDataUrl,
        elementsJson: [],
        presentationId,
        slideId,
      },
      saved: true,
    });

    expect(getDrawing(database, slideId)).toMatchObject({
      drawing: {
        canvasData: redPngDataUrl,
        elementsJson: [],
        presentationId,
        slideId,
      },
      found: true,
    });

    expect(clearDrawing(database, slideId)).toEqual({
      cleared: true,
    });
    expect(getDrawing(database, slideId)).toEqual({
      drawing: null,
      found: true,
    });

    saveDrawing(database, {
      canvasData: transparentPngDataUrl,
      slideId,
    });
    database.prepare('DELETE FROM slides WHERE id = ?').run(slideId);

    expect(database.prepare('SELECT COUNT(*) AS count FROM slide_drawings').get()).toEqual({
      count: 0,
    });
  });

  it('rejects invalid drawing operations', () => {
    database = openDatabase(':memory:');

    expect(getDrawing(database, 99)).toEqual({
      error: 'The requested slide was not found.',
      found: false,
    });
    expect(
      saveDrawing(database, {
        canvasData: 'not-a-png',
        slideId: 99,
      }),
    ).toEqual({
      error: 'The drawing canvas data was invalid.',
      saved: false,
    });
    expect(clearDrawing(database, 99)).toEqual({
      cleared: false,
      error: 'The requested slide was not found.',
    });
  });
});
