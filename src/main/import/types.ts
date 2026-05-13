export type PresentationFormat = 'ppt' | 'pptx';

export type ImportProgressStage = 'reading' | 'parsing' | 'persisting' | 'complete';

export type ImportProgress = {
  importId?: string;
  percent: number;
  stage: ImportProgressStage;
  message: string;
  slideIndex?: number;
  slideCount?: number;
};

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SlideSize = {
  widthEmu: number;
  heightEmu: number;
};

export type ThemeColourMap = Record<string, string>;

export type ThemeFontMap = {
  majorLatin?: string;
  minorLatin?: string;
};

export type ImportedTheme = {
  name?: string;
  colours: ThemeColourMap;
  fonts: ThemeFontMap;
};

export type FillStyle =
  | {
      kind: 'none';
    }
  | {
      kind: 'solid';
      colour?: string;
      alpha?: number;
    }
  | {
      kind: 'gradient';
      stops: Array<{
        colour?: string;
        position: number;
      }>;
    }
  | {
      kind: 'image';
      relationshipId?: string;
    }
  | {
      kind: 'unknown';
      raw: string;
    };

export type StrokeStyle = {
  colour?: string;
  widthEmu?: number;
  dash?: string;
  beginArrow?: string;
  endArrow?: string;
};

export type TextRun = {
  content: string;
  fontFamily?: string;
  fontSizePt?: number;
  bold: boolean;
  italic: boolean;
  colour?: string;
  alignment?: string;
};

export type ShapeGeometry = {
  xEmu?: number;
  yEmu?: number;
  widthEmu?: number;
  heightEmu?: number;
  rotation?: number;
};

export type ImportedShape = {
  kind: string;
  name?: string;
  preset?: string;
  geometry: ShapeGeometry;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  textRuns: TextRun[];
  mediaRelationshipId?: string;
};

export type ImportedMedia = {
  relationshipId: string;
  slideIndex?: number;
  name: string;
  path: string;
  kind: 'audio' | 'image' | 'video' | 'unknown';
  contentType: string;
  extension: string;
  data: Buffer;
};

export type ImportedSlide = {
  sourceId: string;
  order: number;
  layoutName?: string;
  size: SlideSize;
  background?: FillStyle;
  shapes: ImportedShape[];
  media: ImportedMedia[];
};

export type ImportedPresentation = {
  sourcePath: string;
  format: PresentationFormat;
  title: string;
  size: SlideSize;
  theme: ImportedTheme;
  slides: ImportedSlide[];
  requiredFonts: string[];
  extractedAt: string;
};

export type PersistedImportResult = {
  presentationId: number;
  title: string;
  format: PresentationFormat;
  slideCount: number;
  mediaCount: number;
  requiredFonts: string[];
  missingFonts: string[];
};

export type ImportRequest = {
  importId: string;
  filePath: string;
  databasePath: string;
};

export type ImportSuccessMessage = {
  type: 'success';
  result: PersistedImportResult;
};

export type ImportErrorMessage = {
  type: 'error';
  error: string;
};

export type ImportProgressMessage = {
  type: 'progress';
  progress: ImportProgress;
};

export type ImportWorkerMessage = ImportErrorMessage | ImportProgressMessage | ImportSuccessMessage;
