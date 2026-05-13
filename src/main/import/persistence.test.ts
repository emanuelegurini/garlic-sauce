import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from '../database';
import { importPresentationFile, parsePresentationBuffer } from './pipeline';
import { persistImportedPresentation } from './persistence';
import { createNotesPptx, createSamplePptx } from './test-fixtures';

let database: AppDatabase | undefined;
const tempPaths: string[] = [];

afterEach(() => {
  database?.close();
  database = undefined;

  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { force: true, recursive: true });
  }
});

describe('presentation import persistence', () => {
  it('stores imported presentations, slides, shapes, text, media, theme, and fonts transactionally', () => {
    database = openDatabase(':memory:');
    const presentation = parsePresentationBuffer(
      createSamplePptx(),
      '/tmp/quarterly-training.pptx',
    );
    const result = persistImportedPresentation(database, presentation, ['Aptos']);

    expect(result).toMatchObject({
      presentationId: 1,
      title: 'Quarterly Training',
      format: 'pptx',
      slideCount: 1,
      mediaCount: 1,
      missingFonts: ['Aptos'],
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM presentations').get()).toEqual({
      count: 1,
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM slides').get()).toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM shapes').get()).toEqual({ count: 2 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM text_runs').get()).toEqual({
      count: 1,
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM media').get()).toEqual({ count: 1 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM presentation_themes').get()).toEqual({
      count: 1,
    });
    expect(
      database
        .prepare('SELECT font_family, is_missing FROM required_fonts WHERE font_family = ?')
        .get('Aptos'),
    ).toEqual({
      font_family: 'Aptos',
      is_missing: 1,
    });
  });

  it('runs the file import pipeline into a SQLite database', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-sauce-import-'));
    tempPaths.push(tempDirectory);
    const filePath = path.join(tempDirectory, 'pipeline.pptx');
    const databasePath = path.join(tempDirectory, 'pipeline.db');
    fs.writeFileSync(filePath, createSamplePptx());

    const progressMessages: string[] = [];
    const result = importPresentationFile(
      {
        importId: 'test-import',
        filePath,
        databasePath,
      },
      {
        onProgress: (progress) => progressMessages.push(progress.message),
      },
    );

    expect(result.slideCount).toBe(1);
    expect(progressMessages).toContain('Saving imported presentation');
    expect(progressMessages).toContain('Rendering slide images');

    database = openDatabase(databasePath);
    expect(database.prepare('SELECT title FROM presentations').get()).toEqual({
      title: 'Quarterly Training',
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM slide_images').get()).toEqual({
      count: 1,
    });
    const image = database.prepare('SELECT data FROM slide_images LIMIT 1').get() as
      | { data: Buffer }
      | undefined;
    expect(image?.data.length).toBeGreaterThan(0);
  });

  it('stores extracted presenter notes during import persistence', () => {
    database = openDatabase(':memory:');
    const presentation = parsePresentationBuffer(createNotesPptx(), '/tmp/notes.pptx');

    persistImportedPresentation(database, presentation, []);

    expect(
      database
        .prepare(
          `
            SELECT slide_notes.plain_text, slides.slide_order
            FROM slide_notes
            JOIN slides ON slides.id = slide_notes.slide_id
            ORDER BY slides.slide_order
          `,
        )
        .all(),
    ).toEqual([
      {
        plain_text: 'Welcome the room\nMention safety setup',
        slide_order: 0,
      },
    ]);
  });
});
