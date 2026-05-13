import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from './database';
import {
  decodePng,
  encodeRgbaPng,
  renderAndStoreSlideImage,
  renderSlideToImage,
} from './rasterizer';

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
        VALUES ('/tmp/test.pptx', 'pptx', 'Test Deck', ?, ?)
      `,
    )
    .run(testSlideEmu, testSlideEmu);

  return Number(result?.lastInsertRowid);
}

function insertSlide(presentationId: number, backgroundJson: string | null = null): number {
  const result = database
    ?.prepare(
      `
        INSERT INTO slides (
          presentation_id,
          slide_order,
          source_id,
          width_emu,
          height_emu,
          background_json
        )
        VALUES (?, 0, 'slide1.xml', ?, ?, ?)
      `,
    )
    .run(presentationId, testSlideEmu, testSlideEmu, backgroundJson);

  return Number(result?.lastInsertRowid);
}

function pixelAt(image: ReturnType<typeof decodePng>, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return [
    image.pixels[offset],
    image.pixels[offset + 1],
    image.pixels[offset + 2],
    image.pixels[offset + 3],
  ];
}

describe('slide rasterizer', () => {
  it('renders a solid slide background to a PNG buffer', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(
      presentationId,
      JSON.stringify({ kind: 'solid', colour: '#123456' }),
    );

    const rendered = renderSlideToImage(database, slideId, { widthPx: 16 });
    const decoded = decodePng(rendered.data);

    expect(rendered.data.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(16);
    expect(pixelAt(decoded, 0, 0)).toEqual([0x12, 0x34, 0x56, 255]);
  });

  it('draws text runs inside a text shape', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(
      presentationId,
      JSON.stringify({ kind: 'solid', colour: '#FFFFFF' }),
    );
    const shapeResult = database
      .prepare(
        `
          INSERT INTO shapes (
            slide_id,
            shape_order,
            kind,
            x_emu,
            y_emu,
            width_emu,
            height_emu
          )
          VALUES (?, 0, 'textBox', 0, 0, ?, ?)
        `,
      )
      .run(slideId, testSlideEmu, testSlideEmu);
    const shapeId = Number(shapeResult.lastInsertRowid);

    database
      .prepare(
        `
          INSERT INTO text_runs (
            shape_id,
            run_order,
            content,
            font_size_pt,
            bold,
            italic,
            colour,
            alignment
          )
          VALUES (?, 0, 'A', 24, 1, 0, '#000000', 'ctr')
        `,
      )
      .run(shapeId);

    const decoded = decodePng(renderSlideToImage(database, slideId, { widthPx: 64 }).data);
    const darkPixels = decoded.pixels.reduce((count, value, index, pixels) => {
      if (index % 4 !== 0) {
        return count;
      }

      return value < 64 && pixels[index + 1] < 64 && pixels[index + 2] < 64 ? count + 1 : count;
    }, 0);

    expect(darkPixels).toBeGreaterThan(0);
  });

  it('composites PNG image media onto an image shape', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(
      presentationId,
      JSON.stringify({ kind: 'solid', colour: '#FFFFFF' }),
    );
    const redImage = encodeRgbaPng(
      2,
      2,
      new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]),
    );

    database
      .prepare(
        `
          INSERT INTO shapes (
            slide_id,
            shape_order,
            kind,
            x_emu,
            y_emu,
            width_emu,
            height_emu,
            media_relationship_id
          )
          VALUES (?, 0, 'image', 0, 0, ?, ?, 'rIdImage1')
        `,
      )
      .run(slideId, testSlideEmu, testSlideEmu);
    database
      .prepare(
        `
          INSERT INTO media (
            presentation_id,
            slide_id,
            relationship_id,
            name,
            path,
            kind,
            content_type,
            extension,
            data
          )
          VALUES (?, ?, 'rIdImage1', 'red.png', 'ppt/media/red.png', 'image', 'image/png', 'png', ?)
        `,
      )
      .run(presentationId, slideId, redImage);

    const decoded = decodePng(renderSlideToImage(database, slideId, { widthPx: 16 }).data);

    expect(pixelAt(decoded, 8, 8)).toEqual([255, 0, 0, 255]);
  });

  it('composites PNG image media as a slide background', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(
      presentationId,
      JSON.stringify({ kind: 'image', relationshipId: 'rIdBackground' }),
    );
    const blueImage = encodeRgbaPng(
      2,
      2,
      new Uint8Array([0, 64, 255, 255, 0, 64, 255, 255, 0, 64, 255, 255, 0, 64, 255, 255]),
    );

    database
      .prepare(
        `
          INSERT INTO media (
            presentation_id,
            slide_id,
            relationship_id,
            name,
            path,
            kind,
            content_type,
            extension,
            data
          )
          VALUES (?, ?, 'rIdBackground', 'background.png', 'ppt/media/background.png', 'image', 'image/png', 'png', ?)
        `,
      )
      .run(presentationId, slideId, blueImage);

    const decoded = decodePng(renderSlideToImage(database, slideId, { widthPx: 16 }).data);

    expect(pixelAt(decoded, 8, 8)).toEqual([0, 64, 255, 255]);
  });

  it('stores a placeholder image when a slide fails to render', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation();
    const slideId = insertSlide(presentationId, '{bad-json');

    const image = renderAndStoreSlideImage(database, slideId, { widthPx: 16 });
    const row = database.prepare('SELECT COUNT(*) AS count FROM slide_images').get();

    expect(image.renderError).toBeTruthy();
    expect(row).toEqual({ count: 1 });
    expect(() => decodePng(image.data)).not.toThrow();
  });
});
