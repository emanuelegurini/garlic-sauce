import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { openDatabase } from './main/database';

let mainWindow: BrowserWindow | null = null;
let closeDatabase: (() => void) | null = null;

const createWindow = () => {
  const database = openDatabase(path.join(app.getPath('userData'), 'garlic-sauce.db'));
  closeDatabase = () => database.close();

  mainWindow = new BrowserWindow({
    height: 720,
    minHeight: 480,
    minWidth: 720,
    show: false,
    title: 'Garlic Sauce',
    width: 1080,
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  closeDatabase?.();
  closeDatabase = null;

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
