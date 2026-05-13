import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from './database';
import { getSlideList, toggleSlideHidden } from './presentation-navigation';

let database: AppDatabase | undefined;
const testSlideEmu = 914_400;

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
        VALUES ('/tmp/navigation.pptx', 'pptx', 'Navigation Deck', ?, ?)
      `,
    )
    .run(testSlideEmu, testSlideEmu);

  return Number(result?.lastInsertRowid);
}

function insertSlide(presentationId: number, slideOrder: number, hidden = 0): void {
  database
    ?.prepare(
      `
        INSERT INTO slides (
          presentation_id,
          slide_order,
          source_id,
          width_emu,
          height_emu,
          background_json,
          hidden
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      presentationId,
      slideOrder,
      `slide${slideOrder + 1}.xml`,
      testSlideEmu,
      testSlideEmu,
      JSON.stringify({ kind: 'solid', colour: slideOrder === 0 ? '#FFFFFF' : '#F4F6F8' }),
      hidden,
    );
}

describe('presentation navigation main-process helpers', () => {
  it('returns slide list thumbnails with hidden flags', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    insertSlide(presentationId, 0);
    insertSlide(presentationId, 1, 1);

    const response = getSlideList(database, presentationId);

    expect(response).toMatchObject({
      found: true,
      slides: [
        {
          hidden: false,
          slideOrder: 0,
        },
        {
          hidden: true,
          slideOrder: 1,
        },
      ],
    });

    if (response.found) {
      expect(response.slides[0].thumbnailDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(response.slides[1].thumbnailDataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it('rejects slide list requests for missing presentations', () => {
    database = openDatabase(':memory:');

    expect(getSlideList(database, 42)).toEqual({
      error: 'The requested presentation was not found.',
      found: false,
    });
  });

  it('toggles a slide hidden flag and persists the updated value', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    insertSlide(presentationId, 0);

    expect(toggleSlideHidden(database, { presentationId, slideOrder: 0 })).toEqual({
      found: true,
      hidden: true,
    });
    expect(database.prepare('SELECT hidden FROM slides WHERE slide_order = 0').get()).toEqual({
      hidden: 1,
    });

    expect(toggleSlideHidden(database, { presentationId, slideOrder: 0 })).toEqual({
      found: true,
      hidden: false,
    });
    expect(database.prepare('SELECT hidden FROM slides WHERE slide_order = 0').get()).toEqual({
      hidden: 0,
    });
  });

  it('returns an error when toggling an unknown slide', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();

    expect(toggleSlideHidden(database, { presentationId, slideOrder: 0 })).toEqual({
      error: 'The requested slide was not found.',
      found: false,
    });
  });
});
