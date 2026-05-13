import path from 'node:path';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { openDatabase, type AppDatabase } from './main/database';
import { clearDrawing, getDrawing, saveDrawing } from './main/drawing';
import { PresentationImportManager, type ImportEvent } from './main/import/worker-manager';
import { runImportWorker } from './main/import/worker-thread';
import { getNotes, getNotesForPresentation, saveNotes, type NotesSlideContext } from './main/notes';
import { getSlideList, toggleSlideHidden } from './main/presentation-navigation';
import { ensureStoredSlideImage } from './main/rasterizer';

if (!isMainThread) {
  runImportWorker(workerData, parentPort);
} else {
  void startElectronApp();
}

async function startElectronApp(): Promise<void> {
  const { app, BrowserWindow, dialog, ipcMain } = await import('electron');

  let mainWindow: ElectronBrowserWindow | null = null;
  let notesWindow: ElectronBrowserWindow | null = null;
  let database: AppDatabase | null = null;
  let closeDatabase: (() => void) | null = null;
  let importManager: PresentationImportManager | null = null;
  let currentNotesSlide: NotesSlideContext | null = null;

  const emitImportEvent = (importId: string, event: ImportEvent) => {
    mainWindow?.webContents.send('presentation:import-event', {
      importId,
      ...event,
    });
  };

  const emitNotesSlideChanged = () => {
    notesWindow?.webContents.send('notes-window:slide-changed', currentNotesSlide);
  };

  const rendererHtmlPath = () =>
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);

  const loadRendererWindow = (window: ElectronBrowserWindow, windowMode: 'main' | 'notes') => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const devServerUrl = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);

      if (windowMode !== 'main') {
        devServerUrl.searchParams.set('window', windowMode);
      }

      void window.loadURL(devServerUrl.toString());
      return;
    }

    if (windowMode === 'notes') {
      void window.loadFile(rendererHtmlPath(), {
        query: {
          window: windowMode,
        },
      });
      return;
    }

    void window.loadFile(rendererHtmlPath());
  };

  const createNotesWindow = () => {
    if (notesWindow && !notesWindow.isDestroyed()) {
      notesWindow.show();
      notesWindow.focus();
      emitNotesSlideChanged();
      return notesWindow;
    }

    notesWindow = new BrowserWindow({
      backgroundColor: '#f4f6f8',
      height: 720,
      minHeight: 420,
      minWidth: 380,
      show: false,
      title: 'Presenter Notes',
      width: 520,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
      },
    });

    notesWindow.setContentProtection(true);
    notesWindow.setSkipTaskbar(true);

    notesWindow.once('ready-to-show', () => {
      notesWindow?.show();
      emitNotesSlideChanged();
    });

    notesWindow.webContents.on('did-finish-load', emitNotesSlideChanged);

    notesWindow.on('closed', () => {
      notesWindow = null;
    });

    loadRendererWindow(notesWindow, 'notes');

    return notesWindow;
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

    loadRendererWindow(mainWindow, 'main');
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

  ipcMain.handle('presentation:get-slide-list', (_event, presentationId: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return getSlideList(database, presentationId);
  });

  ipcMain.handle('presentation:toggle-slide-hidden', (_event, request: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return toggleSlideHidden(database, request);
  });

  ipcMain.handle('drawing:get', (_event, slideId: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return getDrawing(database, slideId);
  });

  ipcMain.handle('drawing:save', (_event, request: unknown) => {
    if (!database) {
      return {
        saved: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return saveDrawing(database, request);
  });

  ipcMain.handle('drawing:clear', (_event, slideId: unknown) => {
    if (!database) {
      return {
        cleared: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return clearDrawing(database, slideId);
  });

  ipcMain.handle('notes:get', (_event, slideId: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return getNotes(database, slideId);
  });

  ipcMain.handle('notes:save', (_event, request: unknown) => {
    if (!database) {
      return {
        saved: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return saveNotes(database, request);
  });

  ipcMain.handle('notes:get-for-presentation', (_event, presentationId: unknown) => {
    if (!database) {
      return {
        found: false as const,
        error: 'The presentation database is not available.',
      };
    }

    return getNotesForPresentation(database, presentationId);
  });

  ipcMain.handle('notes:open-window', (_event, context: unknown) => {
    if (context !== undefined) {
      if (context !== null && !isNotesSlideContext(context)) {
        return {
          error: 'The notes window context was invalid.',
          opened: false as const,
        };
      }

      currentNotesSlide = context;
    }

    createNotesWindow();
    emitNotesSlideChanged();

    return {
      opened: true as const,
    };
  });

  ipcMain.handle('notes:set-current-slide', (_event, context: unknown) => {
    if (context !== null && !isNotesSlideContext(context)) {
      return {
        error: 'The notes slide context was invalid.',
        found: false as const,
      };
    }

    currentNotesSlide = context;
    emitNotesSlideChanged();

    return {
      found: true as const,
    };
  });

  ipcMain.handle('notes:get-current-slide', () => currentNotesSlide);

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

function isNotesSlideContext(value: unknown): value is NotesSlideContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const context = value as Partial<Record<keyof NotesSlideContext, unknown>>;

  return (
    typeof context.presentationId === 'number' &&
    Number.isInteger(context.presentationId) &&
    context.presentationId > 0 &&
    typeof context.slideId === 'number' &&
    Number.isInteger(context.slideId) &&
    context.slideId > 0 &&
    typeof context.slideOrder === 'number' &&
    Number.isInteger(context.slideOrder) &&
    context.slideOrder >= 0 &&
    typeof context.title === 'string'
  );
}
