import type { MessagePort } from 'node:worker_threads';
import { importPresentationFile } from './pipeline';
import type { ImportRequest, ImportWorkerMessage } from './types';

export type ImportWorkerData = ImportRequest & {
  workerKind: 'presentation-import';
};

export function isImportWorkerData(value: unknown): value is ImportWorkerData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Partial<ImportWorkerData>;

  return (
    data.workerKind === 'presentation-import' &&
    typeof data.importId === 'string' &&
    typeof data.filePath === 'string' &&
    typeof data.databasePath === 'string'
  );
}

function post(parentPort: MessagePort, message: ImportWorkerMessage): void {
  parentPort.postMessage(message);
}

function toUserFacingError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'The PowerPoint file could not be imported.';
}

export function runImportWorker(workerData: unknown, parentPort: MessagePort | null): void {
  if (!parentPort) {
    throw new Error('Import worker started without a parent port.');
  }

  if (!isImportWorkerData(workerData)) {
    post(parentPort, {
      type: 'error',
      error: 'Import worker received an invalid request.',
    });
    return;
  }

  try {
    const result = importPresentationFile(workerData, {
      onProgress: (progress) =>
        post(parentPort, {
          type: 'progress',
          progress,
        }),
    });

    post(parentPort, {
      type: 'success',
      result,
    });
  } catch (error) {
    post(parentPort, {
      type: 'error',
      error: toUserFacingError(error),
    });
  }
}
