import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('garlicSauce', {
  cancelImport: (importId: string) => ipcRenderer.invoke('presentation:cancel-import', importId),
  getSlideImage: (request: GarlicSauceSlideImageRequest) =>
    ipcRenderer.invoke('presentation:get-slide-image', request),
  importPresentation: () => ipcRenderer.invoke('presentation:select-and-import'),
  onImportEvent: (listener: (event: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, event: unknown) => listener(event);

    ipcRenderer.on('presentation:import-event', wrappedListener);

    return () => {
      ipcRenderer.removeListener('presentation:import-event', wrappedListener);
    };
  },
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
