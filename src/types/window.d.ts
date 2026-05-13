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

  interface Window {
    garlicSauce?: {
      cancelImport: (importId: string) => Promise<boolean>;
      getSlideImage: (
        request: GarlicSauceSlideImageRequest,
      ) => Promise<GarlicSauceSlideImageResponse>;
      importPresentation: () => Promise<GarlicSauceImportStart>;
      onImportEvent: (listener: (event: GarlicSauceImportEvent) => void) => () => void;
      platform: NodeJS.Platform;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
