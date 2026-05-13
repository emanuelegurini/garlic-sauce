import path from 'node:path';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { openDatabase } from './main/database';
import { PresentationImportManager, type ImportEvent } from './main/import/worker-manager';
import { runImportWorker } from './main/import/worker-thread';

if (!isMainThread) {
  runImportWorker(workerData, parentPort);
} else {
  void startElectronApp();
}

async function startElectronApp(): Promise<void> {
  const { app, BrowserWindow, dialog, ipcMain } = await import('electron');

  let mainWindow: ElectronBrowserWindow | null = null;
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
    const database = openDatabase(databasePath);
    closeDatabase = () => database.close();
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
