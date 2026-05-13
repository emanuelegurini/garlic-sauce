import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from './database';
import { getNotes, getNotesForPresentation, saveNotes } from './notes';

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
        VALUES ('/tmp/notes.pptx', 'pptx', 'Notes Deck', 914400, 914400)
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

describe('presenter notes persistence helpers', () => {
  it('creates the slide_notes table during database initialization', () => {
    database = openDatabase(':memory:');

    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'slide_notes'")
        .get(),
    ).toEqual({ name: 'slide_notes' });
  });

  it('reads empty notes, upserts rich notes, lists by presentation, and cascades deletes', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const firstSlideId = insertSlide(presentationId, 0);
    const secondSlideId = insertSlide(presentationId, 1);

    expect(getNotes(database, firstSlideId)).toEqual({
      found: true,
      note: {
        contentJson: {},
        plainText: '',
        presentationId,
        slideId: firstSlideId,
        slideOrder: 0,
      },
    });

    const firstSave = saveNotes(database, {
      contentJson: { html: '<p>Opening note</p>', type: 'html' },
      plainText: 'Opening note',
      slideId: firstSlideId,
    });

    expect(firstSave).toMatchObject({
      saved: true,
      note: {
        contentJson: { html: '<p>Opening note</p>', type: 'html' },
        plainText: 'Opening note',
        presentationId,
        slideId: firstSlideId,
        slideOrder: 0,
      },
    });

    expect(
      saveNotes(database, {
        contentJson: { html: '<p>Updated note</p>', type: 'html' },
        plainText: 'Updated note',
        slideId: firstSlideId,
      }),
    ).toMatchObject({
      saved: true,
      note: {
        plainText: 'Updated note',
      },
    });

    expect(getNotesForPresentation(database, presentationId)).toMatchObject({
      found: true,
      notes: [
        {
          plainText: 'Updated note',
          slideId: firstSlideId,
          slideOrder: 0,
        },
        {
          plainText: '',
          slideId: secondSlideId,
          slideOrder: 1,
        },
      ],
    });

    database.prepare('DELETE FROM slides WHERE id = ?').run(firstSlideId);

    expect(database.prepare('SELECT COUNT(*) AS count FROM slide_notes').get()).toEqual({
      count: 0,
    });
  });

  it('rejects note operations for unknown slides and presentations', () => {
    database = openDatabase(':memory:');

    expect(getNotes(database, 99)).toEqual({
      error: 'The requested slide was not found.',
      found: false,
    });
    expect(
      saveNotes(database, {
        contentJson: { html: '<p>Missing</p>', type: 'html' },
        plainText: 'Missing',
        slideId: 99,
      }),
    ).toEqual({
      error: 'The requested slide was not found.',
      saved: false,
    });
    expect(getNotesForPresentation(database, 99)).toEqual({
      error: 'The requested presentation was not found.',
      found: false,
    });
  });
});
