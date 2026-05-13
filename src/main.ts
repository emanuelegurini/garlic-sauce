import path from 'node:path';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { openDatabase, type AppDatabase } from './main/database';
import { PresentationImportManager, type ImportEvent } from './main/import/worker-manager';
import { runImportWorker } from './main/import/worker-thread';
import { ensureStoredSlideImage } from './main/rasterizer';

if (!isMainThread) {
  runImportWorker(workerData, parentPort);
} else {
  void startElectronApp();
}

async function startElectronApp(): Promise<void> {
  const { app, BrowserWindow, dialog, ipcMain } = await import('electron');

  let mainWindow: ElectronBrowserWindow | null = null;
  let database: AppDatabase | null = null;
  let closeDatabase: (() => void) | null = null;
  let importManager: PresentationImportManager | null = null;

  const emitImportEvent = (importId: string, event: ImportEvent) => {
    mainWindow?.webContents.send('presentation:import-event', {
      importId,
      ...event,
    });
  };

  const createWindow = () => {
    const databasePath = path.join(app.getPath('userData'), 'garlic-sauce.db');
    database = openDatabase(databasePath);
    closeDatabase = () => {
      database?.close();
      database = null;
    };
    importManager = new PresentationImportManager(databasePath, emitImportEvent);

    mainWindow = new BrowserWindow({
      height: 720,
      minHeight: 520,
      minWidth: 760,
      show: false,
      title: 'Garlic Sauce',
      width: 1120,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
      },
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      void mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }
  };

  ipcMain.handle('presentation:select-and-import', async () => {
    if (!mainWindow || !importManager) {
      return { cancelled: true as const };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        {
          name: 'PowerPoint presentations',
          extensions: ['pptx', 'ppt'],
        },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true as const };
    }

    const filePath = result.filePaths[0];
    const startedImport = importManager.start(filePath);
    void startedImport.done.catch(() => undefined);

    return {
      cancelled: false as const,
      importId: startedImport.importId,
      filePath,
    };
  });

  ipcMain.handle('presentation:cancel-import', (_event, importId: string) => {
    return importManager?.cancel(importId) ?? false;
  });

  ipcMain.handle('presentation:get-slide-image', (_event, request: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    if (!isSlideImageRequest(request)) {
      return {
        found: false as const,
        error: 'The slide image request was invalid.',
      };
    }

    const image = ensureStoredSlideImage(database, request.presentationId, request.slideOrder);

    if (!image) {
      return {
        found: false as const,
        error: 'The requested slide image was not found.',
      };
    }

    return {
      found: true as const,
      dataUrl: `data:image/png;base64,${Buffer.from(image.data).toString('base64')}`,
      widthPx: image.widthPx,
      heightPx: image.heightPx,
      ...(image.renderError ? { renderError: image.renderError } : {}),
    };
  });

  await app.whenReady();
  createWindow();

  app.on('window-all-closed', () => {
    importManager?.cancelAll();
    closeDatabase?.();
    closeDatabase = null;

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    importManager?.cancelAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

function isSlideImageRequest(
  value: unknown,
): value is { presentationId: number; slideOrder: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<{ presentationId: unknown; slideOrder: unknown }>;

  return (
    typeof request.presentationId === 'number' &&
    Number.isInteger(request.presentationId) &&
    request.presentationId > 0 &&
    typeof request.slideOrder === 'number' &&
    Number.isInteger(request.slideOrder) &&
    request.slideOrder >= 0
  );
}
