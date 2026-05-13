export {};

declare global {
  type GarlicSauceImportProgress = {
    importId?: string;
    percent: number;
    stage: 'reading' | 'parsing' | 'persisting' | 'rendering' | 'complete';
    message: string;
    slideIndex?: number;
    slideCount?: number;
  };

  type GarlicSauceImportResult = {
    presentationId: number;
    title: string;
    format: 'ppt' | 'pptx';
    slideCount: number;
    mediaCount: number;
    requiredFonts: string[];
    missingFonts: string[];
  };

  type GarlicSauceImportEvent =
    | {
        importId: string;
        status: 'progress';
        progress: GarlicSauceImportProgress;
      }
    | {
        importId: string;
        status: 'success';
        result: GarlicSauceImportResult;
      }
    | {
        importId: string;
        status: 'error';
        error: string;
      };

  type GarlicSauceImportStart =
    | {
        cancelled: true;
      }
    | {
        cancelled: false;
        importId: string;
        filePath: string;
      };

  type GarlicSauceSlideImageRequest = {
    presentationId: number;
    slideOrder: number;
  };

  type GarlicSauceSlideImageResponse =
    | {
        found: true;
        dataUrl: string;
        widthPx: number;
        heightPx: number;
        renderError?: string;
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceSlideListItem = {
    hidden: boolean;
    renderError?: string;
    slideId: number;
    slideOrder: number;
    thumbnailDataUrl: string;
  };

  type GarlicSauceSlideListResponse =
    | {
        found: true;
        slides: GarlicSauceSlideListItem[];
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceToggleSlideHiddenResponse =
    | {
        found: true;
        hidden: boolean;
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceNotesContentJson = Record<string, unknown>;

  type GarlicSauceSlideNote = {
    contentJson: GarlicSauceNotesContentJson;
    plainText: string;
    presentationId: number;
    slideId: number;
    slideOrder?: number;
    updatedAt?: string;
  };

  type GarlicSauceGetSlideNoteResponse =
    | {
        found: true;
        note: GarlicSauceSlideNote;
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceSaveSlideNoteResponse =
    | {
        saved: true;
        note: GarlicSauceSlideNote;
      }
    | {
        saved: false;
        error: string;
      };

  type GarlicSaucePresentationNotesResponse =
    | {
        found: true;
        notes: GarlicSauceSlideNote[];
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceNotesSlideContext = {
    presentationId: number;
    slideId: number;
    slideOrder: number;
    title: string;
  };

  type GarlicSauceOpenNotesWindowResponse =
    | {
        opened: true;
      }
    | {
        opened: false;
        error: string;
      };

  type GarlicSauceSetCurrentNotesSlideResponse =
    | {
        found: true;
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceSlideDrawing = {
    canvasData: string;
    presentationId: number;
    slideId: number;
    updatedAt: string;
  };

  type GarlicSauceGetSlideDrawingResponse =
    | {
        found: true;
        drawing: GarlicSauceSlideDrawing | null;
      }
    | {
        found: false;
        error: string;
      };

  type GarlicSauceSaveSlideDrawingResponse =
    | {
        saved: true;
        drawing: GarlicSauceSlideDrawing;
      }
    | {
        saved: false;
        error: string;
      };

  type GarlicSauceClearSlideDrawingResponse =
    | {
        cleared: true;
      }
    | {
        cleared: false;
        error: string;
      };

  interface Window {
    garlicSauce?: {
      cancelImport: (importId: string) => Promise<boolean>;
      clearDrawing: (slideId: number) => Promise<GarlicSauceClearSlideDrawingResponse>;
      getCurrentNotesSlide: () => Promise<GarlicSauceNotesSlideContext | null>;
      getDrawing: (slideId: number) => Promise<GarlicSauceGetSlideDrawingResponse>;
      getNotes: (slideId: number) => Promise<GarlicSauceGetSlideNoteResponse>;
      getNotesForPresentation: (
        presentationId: number,
      ) => Promise<GarlicSaucePresentationNotesResponse>;
      getSlideImage: (
        request: GarlicSauceSlideImageRequest,
      ) => Promise<GarlicSauceSlideImageResponse>;
      getSlideList: (presentationId: number) => Promise<GarlicSauceSlideListResponse>;
      importPresentation: () => Promise<GarlicSauceImportStart>;
      onImportEvent: (listener: (event: GarlicSauceImportEvent) => void) => () => void;
      onNotesSlideChanged: (
        listener: (context: GarlicSauceNotesSlideContext | null) => void,
      ) => () => void;
      openNotesWindow: (
        context?: GarlicSauceNotesSlideContext | null,
      ) => Promise<GarlicSauceOpenNotesWindowResponse>;
      platform: NodeJS.Platform;
      saveDrawing: (
        slideId: number,
        canvasData: string,
      ) => Promise<GarlicSauceSaveSlideDrawingResponse>;
      saveNotes: (
        slideId: number,
        contentJson: GarlicSauceNotesContentJson,
        plainText: string,
      ) => Promise<GarlicSauceSaveSlideNoteResponse>;
      setCurrentNotesSlide: (
        context: GarlicSauceNotesSlideContext | null,
      ) => Promise<GarlicSauceSetCurrentNotesSlideResponse>;
      toggleSlideHidden: (
        presentationId: number,
        slideOrder: number,
      ) => Promise<GarlicSauceToggleSlideHiddenResponse>;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
