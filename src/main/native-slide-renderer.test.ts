import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type AppDatabase } from './database';
import {
  NativeSlideRendererUnavailableError,
  renderAndStorePresentationSlidesWithNativeTools,
} from './native-slide-renderer';
import { encodeRgbaPng } from './rasterizer';

let database: AppDatabase | undefined;
const tempPaths: string[] = [];
const testSlideEmu = 914_400;

afterEach(() => {
  database?.close();
  database = undefined;

  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { force: true, recursive: true });
  }
});

function makeTempDirectory(): string {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-sauce-native-test-'));
  tempPaths.push(tempDirectory);

  return tempDirectory;
}

function writeExecutable(filePath: string, source: string): void {
  fs.writeFileSync(filePath, source, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function insertPresentation(slideCount: number): number {
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
        VALUES ('/tmp/native-test.pptx', 'pptx', 'Native Test Deck', ?, ?)
      `,
    )
    .run(testSlideEmu, testSlideEmu);
  const presentationId = Number(result?.lastInsertRowid);

  for (let slideOrder = 0; slideOrder < slideCount; slideOrder += 1) {
    database
      ?.prepare(
        `
          INSERT INTO slides (
            presentation_id,
            slide_order,
            source_id,
            width_emu,
            height_emu
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(presentationId, slideOrder, `slide${slideOrder + 1}.xml`, testSlideEmu, testSlideEmu);
  }

  return presentationId;
}

describe('native slide renderer', () => {
  it('stores PNG pages produced by native conversion tools', () => {
    database = openDatabase(':memory:');
    const tempDirectory = makeTempDirectory();
    const sourcePath = path.join(tempDirectory, 'deck.pptx');
    const fakeSoffice = path.join(tempDirectory, 'fake-soffice.cjs');
    const fakePdftoppm = path.join(tempDirectory, 'fake-pdftoppm.cjs');
    const png = encodeRgbaPng(
      2,
      2,
      new Uint8Array([16, 32, 48, 255, 16, 32, 48, 255, 16, 32, 48, 255, 16, 32, 48, 255]),
    );
    const previousPng = process.env.GARLIC_SAUCE_TEST_PNG_BASE64;
    process.env.GARLIC_SAUCE_TEST_PNG_BASE64 = png.toString('base64');

    try {
      fs.writeFileSync(sourcePath, 'pptx');
      writeExecutable(
        fakeSoffice,
        `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const outdir = process.argv[process.argv.indexOf('--outdir') + 1];
const source = process.argv[process.argv.length - 1];
fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, path.basename(source, path.extname(source)) + '.pdf'), 'pdf');
`,
      );
      writeExecutable(
        fakePdftoppm,
        `#!/usr/bin/env node
const fs = require('node:fs');
const png = Buffer.from(process.env.GARLIC_SAUCE_TEST_PNG_BASE64, 'base64');
const prefix = process.argv[process.argv.length - 1];
fs.writeFileSync(prefix + '-1.png', png);
fs.writeFileSync(prefix + '-2.png', png);
`,
      );

      const presentationId = insertPresentation(2);
      const progress: number[] = [];
      const result = renderAndStorePresentationSlidesWithNativeTools(
        database,
        sourcePath,
        presentationId,
        {
          onProgress: ({ slideIndex }) => progress.push(slideIndex),
          tools: {
            libreOfficePath: fakeSoffice,
            pdfRenderer: {
              kind: 'pdftoppm',
              path: fakePdftoppm,
            },
          },
        },
      );

      expect(result).toEqual({ failed: 0, rendered: 2 });
      expect(progress).toEqual([1, 2]);
      expect(database.prepare('SELECT COUNT(*) AS count FROM slide_images').get()).toEqual({
        count: 2,
      });
      expect(
        database.prepare('SELECT width_px, height_px FROM slide_images ORDER BY slide_order').all(),
      ).toEqual([
        { height_px: 2, width_px: 2 },
        { height_px: 2, width_px: 2 },
      ]);
    } finally {
      if (previousPng === undefined) {
        delete process.env.GARLIC_SAUCE_TEST_PNG_BASE64;
      } else {
        process.env.GARLIC_SAUCE_TEST_PNG_BASE64 = previousPng;
      }
    }
  });

  it('reports unavailable native tools clearly', () => {
    database = openDatabase(':memory:');
    const presentationId = insertPresentation(1);

    expect(() =>
      renderAndStorePresentationSlidesWithNativeTools(
        database!,
        '/tmp/missing.pptx',
        presentationId,
        {
          tools: {
            libreOfficePath: '/missing/soffice',
            pdfRenderer: {
              kind: 'pdftoppm',
              path: '/missing/pdftoppm',
            },
          },
        },
      ),
    ).toThrow(NativeSlideRendererUnavailableError);
  });

  it('fails native rendering instead of waiting indefinitely when conversion hangs', () => {
    database = openDatabase(':memory:');
    const tempDirectory = makeTempDirectory();
    const sourcePath = path.join(tempDirectory, 'deck.pptx');
    const fakeSoffice = path.join(tempDirectory, 'fake-hanging-soffice.cjs');
    const fakePdftoppm = path.join(tempDirectory, 'fake-pdftoppm.cjs');

    fs.writeFileSync(sourcePath, 'pptx');
    writeExecutable(
      fakeSoffice,
      `#!/usr/bin/env node
setTimeout(() => undefined, 10_000);
`,
    );
    writeExecutable(
      fakePdftoppm,
      `#!/usr/bin/env node
process.exit(0);
`,
    );

    const presentationId = insertPresentation(1);

    expect(() =>
      renderAndStorePresentationSlidesWithNativeTools(database!, sourcePath, presentationId, {
        commandTimeoutMs: 50,
        tools: {
          libreOfficePath: fakeSoffice,
          pdfRenderer: {
            kind: 'pdftoppm',
            path: fakePdftoppm,
          },
        },
      }),
    ).toThrow(/timed out/i);
  });
});
