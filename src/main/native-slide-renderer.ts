import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppDatabase } from './database';
import { decodePng, storeSlideImage } from './rasterizer';

type SlideRow = {
  height_emu: number;
  id: number;
  presentation_id: number;
  slide_order: number;
  width_emu: number;
};

type PdfRendererTool =
  | {
      kind: 'pdftoppm';
      path: string;
    }
  | {
      kind: 'imagemagick';
      path: string;
    };

type NativeSlideRenderTools = {
  libreOfficeLaunchMode: 'direct' | 'launchServices';
  libreOfficePath: string;
  pdfRenderer: PdfRendererTool;
};

type NativeSlideRenderOptions = {
  onProgress?: (progress: { slideCount: number; slideIndex: number }) => void;
  tools?: Partial<NativeSlideRenderTools>;
};

type CommandResult = {
  stderr: string;
  stdout: string;
};

export class NativeSlideRendererUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeSlideRendererUnavailableError';
  }
}

function executablePath(candidate: string): string | undefined {
  if (candidate.includes(path.sep)) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      return undefined;
    }
  }

  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, [candidate], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    return undefined;
  }

  return result.stdout
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0)
    ?.trim();
}

function resolveLibreOfficePath(override?: string): string | undefined {
  if (override !== undefined) {
    return executablePath(override);
  }

  return [
    process.env.LIBREOFFICE_PATH,
    'soffice',
    'libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map(executablePath)
    .find((candidate): candidate is string => Boolean(candidate));
}

function resolvePdfRenderer(override?: PdfRendererTool): PdfRendererTool | undefined {
  if (override) {
    return executablePath(override.path) ? override : undefined;
  }

  const pdftoppmPath = executablePath(process.env.PDFTOPPM_PATH ?? 'pdftoppm');

  if (pdftoppmPath) {
    return {
      kind: 'pdftoppm',
      path: pdftoppmPath,
    };
  }

  const magickPath = executablePath(process.env.MAGICK_PATH ?? 'magick');

  if (magickPath) {
    return {
      kind: 'imagemagick',
      path: magickPath,
    };
  }

  const convertPath = executablePath(process.env.CONVERT_PATH ?? 'convert');

  if (convertPath) {
    return {
      kind: 'imagemagick',
      path: convertPath,
    };
  }

  return undefined;
}

function resolveTools(overrides: Partial<NativeSlideRenderTools> = {}): NativeSlideRenderTools {
  const libreOfficePath = resolveLibreOfficePath(overrides.libreOfficePath);

  if (!libreOfficePath) {
    throw new NativeSlideRendererUnavailableError(
      'LibreOffice was not found. Install LibreOffice and make soffice available on PATH.',
    );
  }

  const pdfRenderer = resolvePdfRenderer(overrides.pdfRenderer);

  if (!pdfRenderer) {
    throw new NativeSlideRendererUnavailableError(
      'A PDF rasterizer was not found. Install Poppler pdftoppm or ImageMagick.',
    );
  }

  return {
    libreOfficeLaunchMode:
      process.platform === 'darwin' && overrides.libreOfficePath === undefined
        ? 'launchServices'
        : 'direct',
    libreOfficePath,
    pdfRenderer,
  };
}

function runCommand(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (result.status !== 0) {
    const detail = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    throw new Error(
      `${path.basename(command)} exited with code ${result.status}.${detail ? `\n${detail}` : ''}`,
    );
  }

  return {
    stderr,
    stdout,
  };
}

function convertPresentationToPdf(
  sourcePath: string,
  outputDirectory: string,
  tools: NativeSlideRenderTools,
): string {
  const profileDirectory = path.join(outputDirectory, 'lo-profile');
  fs.mkdirSync(profileDirectory, { recursive: true });
  const args = [
    `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
    '--headless',
    '--invisible',
    '--nologo',
    '--nodefault',
    '--nofirststartwizard',
    '--nolockcheck',
    '--convert-to',
    'pdf:impress_pdf_Export',
    '--outdir',
    outputDirectory,
    sourcePath,
  ];

  if (tools.libreOfficeLaunchMode === 'launchServices') {
    runCommand('open', ['-W', '-a', 'LibreOffice', '--args', ...args], outputDirectory);
  } else {
    runCommand(tools.libreOfficePath, args, outputDirectory);
  }

  const expectedPdfPath = path.join(
    outputDirectory,
    `${path.basename(sourcePath, path.extname(sourcePath))}.pdf`,
  );

  if (fs.existsSync(expectedPdfPath)) {
    return expectedPdfPath;
  }

  const pdfPath = fs
    .readdirSync(outputDirectory)
    .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
    .map((fileName) => path.join(outputDirectory, fileName))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];

  if (!pdfPath) {
    throw new Error('LibreOffice did not produce a PDF file.');
  }

  return pdfPath;
}

function sortRenderedPagePaths(paths: string[]): string[] {
  return paths.sort((left, right) => {
    const leftNumber = Number(path.basename(left).match(/(\d+)(?=\.png$)/i)?.[1] ?? 0);
    const rightNumber = Number(path.basename(right).match(/(\d+)(?=\.png$)/i)?.[1] ?? 0);

    return leftNumber - rightNumber || left.localeCompare(right);
  });
}

function renderPdfWithPdftoppm(
  pdfPath: string,
  outputDirectory: string,
  pdftoppm: string,
): string[] {
  const outputPrefix = path.join(outputDirectory, 'slide');

  runCommand(pdftoppm, ['-png', '-r', '144', pdfPath, outputPrefix], outputDirectory);

  return sortRenderedPagePaths(
    fs
      .readdirSync(outputDirectory)
      .filter((fileName) => /^slide-\d+\.png$/i.test(fileName))
      .map((fileName) => path.join(outputDirectory, fileName)),
  );
}

function renderPdfWithImageMagick(
  pdfPath: string,
  outputDirectory: string,
  imagemagick: string,
): string[] {
  const outputPattern = path.join(outputDirectory, 'slide-%03d.png');

  runCommand(
    imagemagick,
    ['-density', '144', pdfPath, '-background', 'white', '-alpha', 'remove', outputPattern],
    outputDirectory,
  );

  return sortRenderedPagePaths(
    fs
      .readdirSync(outputDirectory)
      .filter((fileName) => /^slide-\d+\.png$/i.test(fileName))
      .map((fileName) => path.join(outputDirectory, fileName)),
  );
}

function renderPdfToPngs(
  pdfPath: string,
  outputDirectory: string,
  tool: PdfRendererTool,
): string[] {
  if (tool.kind === 'pdftoppm') {
    return renderPdfWithPdftoppm(pdfPath, outputDirectory, tool.path);
  }

  return renderPdfWithImageMagick(pdfPath, outputDirectory, tool.path);
}

function slideRows(database: AppDatabase, presentationId: number): SlideRow[] {
  return database
    .prepare(
      `
        SELECT id, presentation_id, slide_order, width_emu, height_emu
        FROM slides
        WHERE presentation_id = ?
        ORDER BY slide_order
      `,
    )
    .all(presentationId) as SlideRow[];
}

export function renderAndStorePresentationSlidesWithNativeTools(
  database: AppDatabase,
  sourcePath: string,
  presentationId: number,
  options: NativeSlideRenderOptions = {},
): { failed: number; rendered: number } {
  const slides = slideRows(database, presentationId);

  if (slides.length === 0) {
    return { failed: 0, rendered: 0 };
  }

  const tools = resolveTools(options.tools);
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'garlic-sauce-native-render-'));

  try {
    const pdfPath = convertPresentationToPdf(sourcePath, tempDirectory, tools);
    const pagePaths = renderPdfToPngs(pdfPath, tempDirectory, tools.pdfRenderer);

    if (pagePaths.length < slides.length) {
      throw new Error(
        `Native renderer produced ${pagePaths.length} slide image${pagePaths.length === 1 ? '' : 's'} for ${slides.length} slide${slides.length === 1 ? '' : 's'}.`,
      );
    }

    slides.forEach((slide, index) => {
      const data = fs.readFileSync(pagePaths[index]);
      const decoded = decodePng(data);

      storeSlideImage(database, {
        data,
        heightPx: decoded.height,
        presentationId,
        slideId: slide.id,
        slideOrder: slide.slide_order,
        widthPx: decoded.width,
      });
      options.onProgress?.({
        slideCount: slides.length,
        slideIndex: index + 1,
      });
    });

    return {
      failed: 0,
      rendered: slides.length,
    };
  } finally {
    fs.rmSync(tempDirectory, { force: true, recursive: true });
  }
}
