import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('garlicSauce', {
  cancelImport: (importId: string) => ipcRenderer.invoke('presentation:cancel-import', importId),
  getSlideImage: (request: GarlicSauceSlideImageRequest) =>
    ipcRenderer.invoke('presentation:get-slide-image', request),
  getSlideList: (presentationId: number) =>
    ipcRenderer.invoke('presentation:get-slide-list', presentationId),
  getCurrentNotesSlide: () => ipcRenderer.invoke('notes:get-current-slide'),
  getNotes: (slideId: number) => ipcRenderer.invoke('notes:get', slideId),
  getNotesForPresentation: (presentationId: number) =>
    ipcRenderer.invoke('notes:get-for-presentation', presentationId),
  importPresentation: () => ipcRenderer.invoke('presentation:select-and-import'),
  onNotesSlideChanged: (listener: (context: GarlicSauceNotesSlideContext | null) => void) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      context: GarlicSauceNotesSlideContext | null,
    ) => listener(context);

    ipcRenderer.on('notes-window:slide-changed', wrappedListener);

    return () => {
      ipcRenderer.removeListener('notes-window:slide-changed', wrappedListener);
    };
  },
  openNotesWindow: (context?: GarlicSauceNotesSlideContext | null) =>
    ipcRenderer.invoke('notes:open-window', context),
  onImportEvent: (listener: (event: unknown) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, event: unknown) => listener(event);

    ipcRenderer.on('presentation:import-event', wrappedListener);

    return () => {
      ipcRenderer.removeListener('presentation:import-event', wrappedListener);
    };
  },
  platform: process.platform,
  saveNotes: (slideId: number, contentJson: GarlicSauceNotesContentJson, plainText: string) =>
    ipcRenderer.invoke('notes:save', {
      contentJson,
      plainText,
      slideId,
    }),
  setCurrentNotesSlide: (context: GarlicSauceNotesSlideContext | null) =>
    ipcRenderer.invoke('notes:set-current-slide', context),
  toggleSlideHidden: (presentationId: number, slideOrder: number) =>
    ipcRenderer.invoke('presentation:toggle-slide-hidden', {
      presentationId,
      slideOrder,
    }),
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
