import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import type { ImportProgress, ImportWorkerMessage, PersistedImportResult } from './types';
import type { ImportWorkerData } from './worker-thread';

type ImportCompletion =
  | {
      status: 'success';
      result: PersistedImportResult;
    }
  | {
      status: 'error';
      error: string;
    };

export type ImportEvent =
  | {
      status: 'progress';
      progress: ImportProgress;
    }
  | ImportCompletion;

type ActiveImport = {
  worker: Worker;
  done: Promise<PersistedImportResult>;
  cancel: () => void;
};

type ImportStart = {
  importId: string;
  done: Promise<PersistedImportResult>;
};

export class PresentationImportManager {
  private readonly activeImports = new Map<string, ActiveImport>();

  constructor(
    private readonly databasePath: string,
    private readonly emit: (importId: string, event: ImportEvent) => void,
  ) {}

  start(filePath: string): ImportStart {
    const importId = randomUUID();
    const workerData: ImportWorkerData = {
      workerKind: 'presentation-import',
      importId,
      filePath,
      databasePath: this.databasePath,
    };
    const worker = new Worker(__filename, { workerData });
    let settled = false;
    let rejectDone: ((error: Error) => void) | undefined;

    const settle = () => {
      settled = true;
      this.activeImports.delete(importId);
    };

    const done = new Promise<PersistedImportResult>((resolve, reject) => {
      rejectDone = reject;

      worker.on('message', (message: ImportWorkerMessage) => {
        if (message.type === 'progress') {
          this.emit(importId, {
            status: 'progress',
            progress: {
              ...message.progress,
              importId,
            },
          });
          return;
        }

        settle();

        if (message.type === 'success') {
          this.emit(importId, {
            status: 'success',
            result: message.result,
          });
          resolve(message.result);
        } else {
          this.emit(importId, {
            status: 'error',
            error: message.error,
          });
          reject(new Error(message.error));
        }
      });

      worker.on('error', (error) => {
        if (settled) {
          return;
        }

        settle();
        this.emit(importId, {
          status: 'error',
          error: error.message,
        });
        reject(error);
      });

      worker.on('exit', (code) => {
        if (settled || code === 0) {
          return;
        }

        settle();
        const error = code === 1 ? 'Import worker stopped unexpectedly.' : 'Import cancelled.';
        this.emit(importId, {
          status: 'error',
          error,
        });
        reject(new Error(error));
      });
    });

    this.activeImports.set(importId, {
      worker,
      done,
      cancel: () => {
        if (settled) {
          return;
        }

        settle();
        void worker.terminate();
        this.emit(importId, {
          status: 'error',
          error: 'Import cancelled.',
        });
        rejectDone?.(new Error('Import cancelled.'));
      },
    });

    return { importId, done };
  }

  cancel(importId: string): boolean {
    const activeImport = this.activeImports.get(importId);

    if (!activeImport) {
      return false;
    }

    this.activeImports.delete(importId);
    activeImport.cancel();

    return true;
  }

  cancelAll(): void {
    for (const importId of [...this.activeImports.keys()]) {
      this.cancel(importId);
    }
  }
}
