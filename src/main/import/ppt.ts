import path from 'node:path';
import type { ImportedPresentation, ImportedShape, SlideSize, TextRun } from './types';

type CfbDirectoryEntry = {
  name: string;
  type: number;
  startSector: number;
  size: number;
};

type PptRecordStats = {
  slideCount: number;
  size?: SlideSize;
  texts: string[];
};

type ParsePptOptions = {
  signal?: AbortSignal;
};

const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;
const DEFAULT_SLIDE_SIZE: SlideSize = {
  widthEmu: 9_144_000,
  heightEmu: 6_858_000,
};
const POWERPOINT_DOCUMENT_STREAM = 'PowerPoint Document';

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error('Import cancelled.');
  }
}

function isCompoundFile(buffer: Buffer): boolean {
  return (
    buffer.length >= CFB_SIGNATURE.length &&
    buffer.subarray(0, CFB_SIGNATURE.length).equals(CFB_SIGNATURE)
  );
}

function sectorOffset(sectorId: number, sectorSize: number): number {
  return (sectorId + 1) * sectorSize;
}

function readSector(buffer: Buffer, sectorId: number, sectorSize: number): Buffer {
  const offset = sectorOffset(sectorId, sectorSize);
  const endOffset = offset + sectorSize;

  if (offset < 0 || endOffset > buffer.length) {
    throw new Error('The legacy PowerPoint compound file has a corrupt sector chain.');
  }

  return buffer.subarray(offset, endOffset);
}

function readUInt32Array(buffer: Buffer): number[] {
  const values: number[] = [];

  for (let offset = 0; offset + 4 <= buffer.length; offset += 4) {
    values.push(buffer.readUInt32LE(offset));
  }

  return values;
}

function readRegularChain(
  buffer: Buffer,
  fat: number[],
  startSector: number,
  sectorSize: number,
  size?: number,
): Buffer {
  if (startSector === END_OF_CHAIN || startSector === FREE_SECTOR) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];
  const seen = new Set<number>();
  let sectorId = startSector;

  while (sectorId !== END_OF_CHAIN && sectorId !== FREE_SECTOR) {
    if (sectorId >= fat.length || seen.has(sectorId)) {
      throw new Error('The legacy PowerPoint compound file has a corrupt FAT chain.');
    }

    seen.add(sectorId);
    chunks.push(readSector(buffer, sectorId, sectorSize));
    sectorId = fat[sectorId];
  }

  const data = Buffer.concat(chunks);
  return size === undefined ? data : data.subarray(0, size);
}

function readMiniChain(
  miniStream: Buffer,
  miniFat: number[],
  startMiniSector: number,
  miniSectorSize: number,
  size: number,
): Buffer {
  if (startMiniSector === END_OF_CHAIN || startMiniSector === FREE_SECTOR) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];
  const seen = new Set<number>();
  let miniSectorId = startMiniSector;

  while (miniSectorId !== END_OF_CHAIN && miniSectorId !== FREE_SECTOR) {
    if (miniSectorId >= miniFat.length || seen.has(miniSectorId)) {
      throw new Error('The legacy PowerPoint compound file has a corrupt mini FAT chain.');
    }

    seen.add(miniSectorId);
    const offset = miniSectorId * miniSectorSize;
    chunks.push(miniStream.subarray(offset, offset + miniSectorSize));
    miniSectorId = miniFat[miniSectorId];
  }

  return Buffer.concat(chunks).subarray(0, size);
}

function readDirectoryEntries(directoryStream: Buffer): CfbDirectoryEntry[] {
  const entries: CfbDirectoryEntry[] = [];

  for (let offset = 0; offset + 128 <= directoryStream.length; offset += 128) {
    const entry = directoryStream.subarray(offset, offset + 128);
    const nameLength = entry.readUInt16LE(64);
    const type = entry.readUInt8(66);

    if (nameLength < 2 || type === 0) {
      continue;
    }

    entries.push({
      name: entry.subarray(0, nameLength - 2).toString('utf16le'),
      type,
      startSector: entry.readUInt32LE(116),
      size: entry.readUInt32LE(120),
    });
  }

  return entries;
}

function readCompoundFileStreams(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length < 512) {
    throw new Error('The legacy PowerPoint file is too small to be valid.');
  }

  const sectorSize = 1 << buffer.readUInt16LE(30);
  const miniSectorSize = 1 << buffer.readUInt16LE(32);
  const fatSectorCount = buffer.readUInt32LE(44);
  const firstDirectorySector = buffer.readUInt32LE(48);
  const miniStreamCutoff = buffer.readUInt32LE(56);
  const firstMiniFatSector = buffer.readUInt32LE(60);
  const miniFatSectorCount = buffer.readUInt32LE(64);
  const firstDifatSector = buffer.readUInt32LE(68);
  const difatSectorCount = buffer.readUInt32LE(72);
  const fatSectorIds = readUInt32Array(buffer.subarray(76, 512)).filter(
    (sectorId) => sectorId !== FREE_SECTOR,
  );

  let nextDifatSector = firstDifatSector;

  for (let index = 0; index < difatSectorCount; index += 1) {
    const difatSector = readSector(buffer, nextDifatSector, sectorSize);
    const entries = readUInt32Array(difatSector);
    fatSectorIds.push(...entries.slice(0, -1).filter((sectorId) => sectorId !== FREE_SECTOR));
    nextDifatSector = entries.at(-1) ?? END_OF_CHAIN;

    if (nextDifatSector === END_OF_CHAIN) {
      break;
    }
  }

  const fat = fatSectorIds
    .slice(0, fatSectorCount)
    .flatMap((sectorId) => readUInt32Array(readSector(buffer, sectorId, sectorSize)));
  const directoryStream = readRegularChain(buffer, fat, firstDirectorySector, sectorSize);
  const directoryEntries = readDirectoryEntries(directoryStream);
  const rootEntry = directoryEntries.find((entry) => entry.type === 5);
  const miniStream = rootEntry
    ? readRegularChain(buffer, fat, rootEntry.startSector, sectorSize, rootEntry.size)
    : Buffer.alloc(0);
  const miniFat =
    firstMiniFatSector === END_OF_CHAIN
      ? []
      : readUInt32Array(
          readRegularChain(
            buffer,
            fat,
            firstMiniFatSector,
            sectorSize,
            miniFatSectorCount * sectorSize,
          ),
        );
  const streams = new Map<string, Buffer>();

  for (const entry of directoryEntries.filter((directoryEntry) => directoryEntry.type === 2)) {
    const stream =
      entry.size < miniStreamCutoff && miniFat.length > 0
        ? readMiniChain(miniStream, miniFat, entry.startSector, miniSectorSize, entry.size)
        : readRegularChain(buffer, fat, entry.startSector, sectorSize, entry.size);

    streams.set(entry.name, stream);
  }

  return streams;
}

function cleanText(value: string): string | undefined {
  const withoutControlCharacters = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);

      if (code === 0) {
        return '';
      }

      if ((code >= 1 && code <= 8) || (code >= 11 && code <= 31)) {
        return ' ';
      }

      return character;
    })
    .join('');
  const cleaned = withoutControlCharacters.replace(/\s+/g, ' ').trim();

  return cleaned.length > 0 ? cleaned : undefined;
}

function addText(texts: string[], value: string | undefined): void {
  const cleaned = value ? cleanText(value) : undefined;

  if (cleaned && !texts.includes(cleaned)) {
    texts.push(cleaned);
  }
}

function parseDocumentAtom(payload: Buffer): SlideSize | undefined {
  if (payload.length < 8) {
    return undefined;
  }

  const width = payload.readInt32LE(0);
  const height = payload.readInt32LE(4);

  if (width <= 0 || height <= 0) {
    return undefined;
  }

  return {
    widthEmu: Math.round(width * 12_700),
    heightEmu: Math.round(height * 12_700),
  };
}

function scanPptRecords(buffer: Buffer, stats: PptRecordStats, depth = 0): void {
  if (depth > 24) {
    return;
  }

  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const options = buffer.readUInt16LE(offset);
    const recordType = buffer.readUInt16LE(offset + 2);
    const recordLength = buffer.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + recordLength;

    if (recordLength > buffer.length - payloadStart) {
      break;
    }

    const recordVersion = options & 0xf;
    const payload = buffer.subarray(payloadStart, payloadEnd);

    switch (recordType) {
      case 1001:
        stats.size ??= parseDocumentAtom(payload);
        break;
      case 1006:
        stats.slideCount += 1;
        break;
      case 4000:
        addText(stats.texts, payload.toString('utf16le'));
        break;
      case 4008:
        addText(stats.texts, payload.toString('latin1'));
        break;
      default:
        break;
    }

    if (recordVersion === 0xf && payload.length > 0) {
      scanPptRecords(payload, stats, depth + 1);
    }

    offset = payloadEnd;
  }
}

function scanRawTextAtoms(buffer: Buffer, stats: PptRecordStats): void {
  const textRecordTypes = new Set([4000, 4008]);

  for (let offset = 0; offset + 8 <= buffer.length; offset += 1) {
    const recordType = buffer.readUInt16LE(offset + 2);

    if (!textRecordTypes.has(recordType)) {
      continue;
    }

    const recordLength = buffer.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + recordLength;

    if (recordLength === 0 || payloadEnd > buffer.length) {
      continue;
    }

    const payload = buffer.subarray(payloadStart, payloadEnd);
    addText(
      stats.texts,
      recordType === 4000 ? payload.toString('utf16le') : payload.toString('latin1'),
    );
  }
}

function extractPptStats(buffer: Buffer): PptRecordStats {
  const stats: PptRecordStats = {
    slideCount: 0,
    texts: [],
  };

  scanPptRecords(buffer, stats);
  scanRawTextAtoms(buffer, stats);

  return stats;
}

function buildLegacySlideShape(texts: string[]): ImportedShape[] {
  if (texts.length === 0) {
    return [];
  }

  const textRuns: TextRun[] = texts.map((text) => ({
    content: text,
    bold: false,
    italic: false,
  }));

  return [
    {
      kind: 'textBox',
      name: 'Extracted legacy PowerPoint text',
      geometry: {
        xEmu: 0,
        yEmu: 0,
        widthEmu: DEFAULT_SLIDE_SIZE.widthEmu,
        heightEmu: DEFAULT_SLIDE_SIZE.heightEmu,
      },
      textRuns,
    },
  ];
}

export function parsePpt(
  buffer: Buffer,
  sourcePath: string,
  options: ParsePptOptions = {},
): ImportedPresentation {
  throwIfAborted(options.signal);

  const documentBuffer = isCompoundFile(buffer)
    ? readCompoundFileStreams(buffer).get(POWERPOINT_DOCUMENT_STREAM)
    : buffer;

  if (!documentBuffer || documentBuffer.length === 0) {
    throw new Error('The legacy PowerPoint file does not contain a PowerPoint Document stream.');
  }

  const stats = extractPptStats(documentBuffer);
  const slideCount = Math.max(stats.slideCount, 1);
  const size = stats.size ?? DEFAULT_SLIDE_SIZE;
  const slides = Array.from({ length: slideCount }, (_, index) => ({
    sourceId: `${POWERPOINT_DOCUMENT_STREAM}#${index + 1}`,
    order: index,
    size,
    shapes: index === 0 ? buildLegacySlideShape(stats.texts) : [],
    media: [],
  }));

  return {
    sourcePath,
    format: 'ppt',
    title: path.basename(sourcePath, path.extname(sourcePath)),
    size,
    theme: { colours: {}, fonts: {} },
    slides,
    requiredFonts: [],
    extractedAt: new Date().toISOString(),
  };
}
