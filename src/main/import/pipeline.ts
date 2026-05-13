import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../database';
import {
  NativeSlideRendererUnavailableError,
  renderAndStorePresentationSlidesWithNativeTools,
} from '../native-slide-renderer';
import { renderAndStorePresentationSlides } from '../rasterizer';
import { findMissingFonts } from './fonts';
import { parsePpt } from './ppt';
import { parsePptx } from './pptx';
import { persistImportedPresentation } from './persistence';
import type {
  ImportedPresentation,
  ImportProgress,
  ImportRequest,
  PersistedImportResult,
  PresentationFormat,
} from './types';

type ImportPipelineOptions = {
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
};

function report(options: ImportPipelineOptions, progress: ImportProgress): void {
  options.onProgress?.(progress);
}

function extensionToFormat(filePath: string): PresentationFormat {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.pptx') {
    return 'pptx';
  }

  if (extension === '.ppt') {
    return 'ppt';
  }

  throw new Error('Choose a .pptx or .ppt PowerPoint file.');
}

export function parsePresentationBuffer(
  buffer: Buffer,
  filePath: string,
  options: ImportPipelineOptions = {},
): ImportedPresentation {
  if (buffer.length === 0) {
    throw new Error('The selected PowerPoint file is empty.');
  }

  const format = extensionToFormat(filePath);

  if (format === 'pptx') {
    return parsePptx(buffer, filePath, options);
  }

  return parsePpt(buffer, filePath, options);
}

export function importPresentationFile(
  request: ImportRequest,
  options: ImportPipelineOptions = {},
): PersistedImportResult {
  report(options, {
    importId: request.importId,
    percent: 1,
    stage: 'reading',
    message: 'Opening selected file',
  });

  const buffer = fs.readFileSync(request.filePath);
  const presentation = parsePresentationBuffer(buffer, request.filePath, {
    ...options,
    onProgress: (progress) =>
      report(options, {
        ...progress,
        importId: request.importId,
      }),
  });
  const missingFonts = findMissingFonts(presentation.requiredFonts);

  report(options, {
    importId: request.importId,
    percent: 90,
    stage: 'persisting',
    message: 'Saving imported presentation',
    slideCount: presentation.slides.length,
  });

  const database = openDatabase(request.databasePath);

  try {
    const result = persistImportedPresentation(database, presentation, missingFonts);

    report(options, {
      importId: request.importId,
      percent: 92,
      stage: 'rendering',
      message: 'Rendering slide images',
      slideCount: result.slideCount,
    });

    try {
      renderAndStorePresentationSlidesWithNativeTools(
        database,
        request.filePath,
        result.presentationId,
        {
          onProgress: ({ slideIndex, slideCount }) =>
            report(options, {
              importId: request.importId,
              percent: 92 + Math.round((slideIndex / Math.max(slideCount, 1)) * 7),
              stage: 'rendering',
              message: `Rendered slide ${slideIndex} of ${slideCount} with native converter`,
              slideIndex,
              slideCount,
            }),
        },
      );
    } catch (error) {
      const message = nativeRenderFallbackMessage(error);

      report(options, {
        importId: request.importId,
        percent: 92,
        stage: 'rendering',
        message,
        slideCount: result.slideCount,
      });

      renderAndStorePresentationSlides(database, result.presentationId, {
        onProgress: ({ slideIndex, slideCount }) =>
          report(options, {
            importId: request.importId,
            percent: 92 + Math.round((slideIndex / Math.max(slideCount, 1)) * 7),
            stage: 'rendering',
            message: `Rendered slide ${slideIndex} of ${slideCount} with basic renderer`,
            slideIndex,
            slideCount,
          }),
      });
    }

    report(options, {
      importId: request.importId,
      percent: 100,
      stage: 'complete',
      message: 'Import complete',
      slideCount: result.slideCount,
    });

    return result;
  } finally {
    database.close();
  }
}

function nativeRenderFallbackMessage(error: unknown): string {
  if (error instanceof NativeSlideRendererUnavailableError) {
    return `${error.message} Using basic renderer instead.`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return `Native slide rendering failed: ${error.message}. Using basic renderer instead.`;
  }

  return 'Native slide rendering failed. Using basic renderer instead.';
}
