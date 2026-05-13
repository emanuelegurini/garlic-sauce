import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FONT_EXTENSIONS = new Set(['.dfont', '.otc', '.otf', '.ttc', '.ttf']);
const COMMON_FONT_FAMILIES = [
  'Arial',
  'Aptos',
  'Calibri',
  'Cambria',
  'Courier New',
  'Helvetica',
  'Times New Roman',
  'Verdana',
];

function fontDirectories(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/System/Library/Fonts',
      '/System/Library/Fonts/Supplemental',
      '/Library/Fonts',
      path.join(os.homedir(), 'Library', 'Fonts'),
    ];
  }

  if (process.platform === 'win32') {
    const windowsRoot = process.env.windir ?? 'C:\\Windows';
    return [path.join(windowsRoot, 'Fonts')];
  }

  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    path.join(os.homedir(), '.fonts'),
    path.join(os.homedir(), '.local', 'share', 'fonts'),
  ];
}

function addFontFile(fonts: Set<string>, filePath: string): void {
  const extension = path.extname(filePath).toLowerCase();

  if (!FONT_EXTENSIONS.has(extension)) {
    return;
  }

  const family = path
    .basename(filePath, extension)
    .replace(/[-_](bold|italic|regular|light|medium|semibold|thin|black).*$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();

  if (family.length > 0) {
    fonts.add(family.toLowerCase());
  }
}

function walkFontDirectory(directory: string, fonts: Set<string>, depth = 0): void {
  if (depth > 3 || !fs.existsSync(directory)) {
    return;
  }

  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkFontDirectory(entryPath, fonts, depth + 1);
    } else if (entry.isFile()) {
      addFontFile(fonts, entryPath);
    }
  }
}

export function listInstalledFontFamilies(): Set<string> {
  const fonts = new Set(COMMON_FONT_FAMILIES.map((font) => font.toLowerCase()));

  for (const directory of fontDirectories()) {
    walkFontDirectory(directory, fonts);
  }

  return fonts;
}

export function findMissingFonts(
  requiredFonts: string[],
  installedFonts = listInstalledFontFamilies(),
): string[] {
  return requiredFonts
    .filter((font) => !installedFonts.has(font.toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}
