import { inflateRawSync } from 'node:zlib';

export type ZipEntries = Map<string, Buffer>;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_VALUE = 0xffffffff;

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 65_557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }

  throw new Error('The file is not a valid ZIP archive.');
}

function inflateEntry(method: number, compressedData: Buffer, entryName: string): Buffer {
  if (method === 0) {
    return Buffer.from(compressedData);
  }

  if (method === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error(`Unsupported ZIP compression method ${method} for ${entryName}.`);
}

export function readZipEntries(buffer: Buffer): ZipEntries {
  const endOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error('Multi-disk ZIP archives are not supported.');
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  if (centralDirectorySize === ZIP64_VALUE || centralDirectoryOffset === ZIP64_VALUE) {
    throw new Error('ZIP64 PowerPoint archives are not supported yet.');
  }

  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error('The ZIP central directory extends beyond the archive.');
  }

  const entries: ZipEntries = new Map();
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE_HEADER) {
      throw new Error('The ZIP central directory is corrupt.');
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    if ((flags & 0x1) === 0x1) {
      throw new Error('Encrypted PowerPoint archives are not supported.');
    }

    if (
      compressedSize === ZIP64_VALUE ||
      uncompressedSize === ZIP64_VALUE ||
      localHeaderOffset === ZIP64_VALUE
    ) {
      throw new Error('ZIP64 PowerPoint entries are not supported yet.');
    }

    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`The ZIP local header for ${fileName} is corrupt.`);
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEndOffset = dataOffset + compressedSize;

    if (dataEndOffset > buffer.length) {
      throw new Error(`The ZIP entry ${fileName} extends beyond the archive.`);
    }

    if (!fileName.endsWith('/')) {
      entries.set(
        fileName,
        inflateEntry(method, buffer.subarray(dataOffset, dataEndOffset), fileName),
      );
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}
