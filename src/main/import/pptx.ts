import path from 'node:path';
import { basename } from 'node:path';
import { readZipEntries, type ZipEntries } from './zip';
import {
  findElements,
  findFirstElement,
  findStartTags,
  parseRelationships,
  relationshipMap,
  resolvePackagePath,
  textContent,
} from './xml';
import type {
  FillStyle,
  ImportedMedia,
  ImportedPresentation,
  ImportedShape,
  ImportedSlide,
  ImportedTheme,
  ImportProgress,
  ShapeGeometry,
  SlideSize,
  StrokeStyle,
  TextRun,
} from './types';

type ParsePptxOptions = {
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
};

type ContentTypes = {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
};

const DEFAULT_SLIDE_SIZE: SlideSize = {
  widthEmu: 12_192_000,
  heightEmu: 6_858_000,
};

const MEDIA_KIND_BY_RELATIONSHIP = new Map([
  ['image', 'image'],
  ['audio', 'audio'],
  ['video', 'video'],
] as const);

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error('Import cancelled.');
  }
}

function report(options: ParsePptxOptions, progress: ImportProgress): void {
  options.onProgress?.(progress);
}

function getXml(entries: ZipEntries, entryPath: string): string | undefined {
  return entries.get(entryPath)?.toString('utf8');
}

function getRequiredXml(entries: ZipEntries, entryPath: string): string {
  const xml = getXml(entries, entryPath);

  if (!xml) {
    throw new Error(`The PowerPoint archive is missing ${entryPath}.`);
  }

  return xml;
}

function numberAttribute(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSlideSize(presentationXml: string): SlideSize {
  const slideSize = findStartTags(presentationXml, 'sldSz')[0];
  const widthEmu = numberAttribute(slideSize?.attributes.cx);
  const heightEmu = numberAttribute(slideSize?.attributes.cy);

  return {
    widthEmu: widthEmu ?? DEFAULT_SLIDE_SIZE.widthEmu,
    heightEmu: heightEmu ?? DEFAULT_SLIDE_SIZE.heightEmu,
  };
}

function parseContentTypes(entries: ZipEntries): ContentTypes {
  const contentTypesXml = getXml(entries, '[Content_Types].xml') ?? '';
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();

  for (const defaultElement of findStartTags(contentTypesXml, 'Default')) {
    const extension = defaultElement.attributes.Extension?.toLowerCase();
    const contentType = defaultElement.attributes.ContentType;

    if (extension && contentType) {
      defaults.set(extension, contentType);
    }
  }

  for (const overrideElement of findStartTags(contentTypesXml, 'Override')) {
    const partName = overrideElement.attributes.PartName?.replace(/^\//, '');
    const contentType = overrideElement.attributes.ContentType;

    if (partName && contentType) {
      overrides.set(path.posix.normalize(partName), contentType);
    }
  }

  return { defaults, overrides };
}

function contentTypeFor(entryPath: string, contentTypes: ContentTypes): string {
  const normalizedPath = path.posix.normalize(entryPath);
  const extension = path.posix.extname(normalizedPath).slice(1).toLowerCase();

  return (
    contentTypes.overrides.get(normalizedPath) ??
    contentTypes.defaults.get(extension) ??
    fallbackContentType(extension)
  );
}

function fallbackContentType(extension: string): string {
  switch (extension) {
    case 'emf':
      return 'image/x-emf';
    case 'gif':
      return 'image/gif';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'mp3':
      return 'audio/mpeg';
    case 'mp4':
      return 'video/mp4';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'wmf':
      return 'image/wmf';
    default:
      return 'application/octet-stream';
  }
}

function parseTheme(entries: ZipEntries): ImportedTheme {
  const themeEntry = [...entries.keys()].find((entryPath) =>
    /^ppt\/theme\/theme\d+\.xml$/.test(entryPath),
  );
  const themeXml = themeEntry ? getXml(entries, themeEntry) : undefined;

  if (!themeXml) {
    return { colours: {}, fonts: {} };
  }

  const themeTag = findStartTags(themeXml, 'theme')[0];
  const colours: Record<string, string> = {};
  const fonts: ImportedTheme['fonts'] = {};
  const colourScheme = findFirstElement(themeXml, 'clrScheme');

  if (colourScheme) {
    for (const colourName of [
      'dk1',
      'lt1',
      'dk2',
      'lt2',
      'accent1',
      'accent2',
      'accent3',
      'accent4',
      'accent5',
      'accent6',
      'hlink',
      'folHlink',
    ]) {
      const colourElement = findFirstElement(colourScheme.inner, colourName);
      const colour = colourElement
        ? parseColour(colourElement.full, { colours: {}, fonts: {} })
        : undefined;

      if (colour) {
        colours[colourName] = colour;
      }
    }
  }

  const majorFont = findFirstElement(themeXml, 'majorFont');
  const minorFont = findFirstElement(themeXml, 'minorFont');
  fonts.majorLatin = firstTypeface(majorFont?.inner);
  fonts.minorLatin = firstTypeface(minorFont?.inner);

  return {
    name: themeTag?.attributes.name,
    colours,
    fonts,
  };
}

function firstTypeface(xml: string | undefined): string | undefined {
  if (!xml) {
    return undefined;
  }

  return findStartTags(xml, 'latin')[0]?.attributes.typeface;
}

function parseColour(xml: string, theme: ImportedTheme): string | undefined {
  const srgb = findStartTags(xml, 'srgbClr')[0]?.attributes.val;

  if (srgb) {
    return `#${srgb.toUpperCase()}`;
  }

  const systemColour = findStartTags(xml, 'sysClr')[0];
  const systemValue = systemColour?.attributes.lastClr ?? systemColour?.attributes.val;

  if (systemValue) {
    return `#${systemValue.toUpperCase()}`;
  }

  const schemeColour = findStartTags(xml, 'schemeClr')[0]?.attributes.val;

  if (schemeColour) {
    const resolved = theme.colours[schemeColour];
    return resolved ?? `scheme:${schemeColour}`;
  }

  const presetColour = findStartTags(xml, 'prstClr')[0]?.attributes.val;

  return presetColour ? `preset:${presetColour}` : undefined;
}

function parseAlpha(xml: string): number | undefined {
  const alpha = numberAttribute(findStartTags(xml, 'alpha')[0]?.attributes.val);
  return alpha === undefined ? undefined : alpha / 100_000;
}

function parseFill(xml: string, theme: ImportedTheme): FillStyle | undefined {
  if (findStartTags(xml, 'noFill').length > 0) {
    return { kind: 'none' };
  }

  const solidFill = findFirstElement(xml, 'solidFill');

  if (solidFill) {
    return {
      kind: 'solid',
      colour: parseColour(solidFill.full, theme),
      alpha: parseAlpha(solidFill.full),
    };
  }

  const gradientFill = findFirstElement(xml, 'gradFill');

  if (gradientFill) {
    return {
      kind: 'gradient',
      stops: findElements(gradientFill.inner, 'gs').map((stop) => ({
        colour: parseColour(stop.full, theme),
        position: (numberAttribute(stop.attributes.pos) ?? 0) / 100_000,
      })),
    };
  }

  const blipFill = findFirstElement(xml, 'blipFill');
  const blip = blipFill ? findStartTags(blipFill.inner, 'blip')[0] : undefined;

  if (blipFill) {
    return {
      kind: 'image',
      relationshipId: blip?.attributes['r:embed'] ?? blip?.attributes.embed,
    };
  }

  return undefined;
}

function parseStroke(xml: string, theme: ImportedTheme): StrokeStyle | undefined {
  const line = findFirstElement(xml, 'ln');

  if (!line) {
    return undefined;
  }

  const headEnd = findStartTags(line.inner, 'headEnd')[0];
  const tailEnd = findStartTags(line.inner, 'tailEnd')[0];

  return {
    colour: parseColour(line.full, theme),
    widthEmu: numberAttribute(line.attributes.w),
    dash: findStartTags(line.inner, 'prstDash')[0]?.attributes.val,
    beginArrow: headEnd?.attributes.type,
    endArrow: tailEnd?.attributes.type,
  };
}

function parseGeometry(xml: string): ShapeGeometry {
  const transform = findFirstElement(xml, 'xfrm');
  const transformXml = transform?.inner ?? '';
  const offset = findStartTags(transformXml, 'off')[0];
  const extent = findStartTags(transformXml, 'ext')[0];
  const rotation = numberAttribute(transform?.attributes.rot);

  return {
    xEmu: numberAttribute(offset?.attributes.x),
    yEmu: numberAttribute(offset?.attributes.y),
    widthEmu: numberAttribute(extent?.attributes.cx),
    heightEmu: numberAttribute(extent?.attributes.cy),
    rotation: rotation === undefined ? undefined : rotation / 60_000,
  };
}

function resolveFontTypeface(
  typeface: string | undefined,
  theme: ImportedTheme,
): string | undefined {
  if (!typeface) {
    return undefined;
  }

  if (typeface === '+mj-lt') {
    return theme.fonts.majorLatin;
  }

  if (typeface === '+mn-lt') {
    return theme.fonts.minorLatin;
  }

  return typeface;
}

function parseTextRuns(xml: string, theme: ImportedTheme): TextRun[] {
  const paragraphs = findElements(xml, 'p');
  const runs: TextRun[] = [];

  for (const paragraph of paragraphs) {
    const alignment = findStartTags(paragraph.inner, 'pPr')[0]?.attributes.algn;
    const defaultRunPropertiesElement = findFirstElement(paragraph.inner, 'defRPr');
    const defaultRunPropertiesStart = findStartTags(paragraph.inner, 'defRPr')[0];
    const defaultRunPropertiesAttributes =
      defaultRunPropertiesElement?.attributes ?? defaultRunPropertiesStart?.attributes;
    const defaultRunPropertiesXml =
      defaultRunPropertiesElement?.full ?? defaultRunPropertiesStart?.full ?? '';

    for (const run of findElements(paragraph.inner, 'r')) {
      const runText = textContent(run.inner, 't');

      if (runText.length === 0) {
        continue;
      }

      const runPropertiesElement = findFirstElement(run.inner, 'rPr');
      const runPropertiesStart = findStartTags(run.inner, 'rPr')[0];
      const runPropertiesAttributes =
        runPropertiesElement?.attributes ?? runPropertiesStart?.attributes;
      const propertiesXml =
        runPropertiesElement?.full ?? runPropertiesStart?.full ?? defaultRunPropertiesXml;
      const typeface = findStartTags(propertiesXml, 'latin')[0]?.attributes.typeface;
      const fontSize = numberAttribute(
        runPropertiesAttributes?.sz ?? defaultRunPropertiesAttributes?.sz,
      );

      runs.push({
        content: runText,
        fontFamily: resolveFontTypeface(typeface, theme),
        fontSizePt: fontSize === undefined ? undefined : fontSize / 100,
        bold: (runPropertiesAttributes?.b ?? defaultRunPropertiesAttributes?.b) === '1',
        italic: (runPropertiesAttributes?.i ?? defaultRunPropertiesAttributes?.i) === '1',
        colour: parseColour(propertiesXml, theme),
        alignment,
      });
    }

    for (const lineBreak of findStartTags(paragraph.inner, 'br')) {
      const runProperties = findStartTags(lineBreak.full, 'rPr')[0];
      runs.push({
        content: '\n',
        fontFamily: resolveFontTypeface(
          findStartTags(runProperties?.full ?? '', 'latin')[0]?.attributes.typeface,
          theme,
        ),
        fontSizePt: undefined,
        bold: false,
        italic: false,
        alignment,
      });
    }
  }

  return runs;
}

function parseShape(xml: string, theme: ImportedTheme): ImportedShape {
  const nonVisualProperties = findStartTags(xml, 'cNvPr')[0];
  const shapeProperties = findFirstElement(xml, 'spPr');
  const shapePropertyXml = shapeProperties?.full ?? '';
  const preset = findStartTags(shapePropertyXml, 'prstGeom')[0]?.attributes.prst;
  const hasText = findFirstElement(xml, 'txBody') !== undefined;
  const shapeLocks = findStartTags(xml, 'cNvSpPr')[0];
  const isTextBox = shapeLocks?.attributes.txBox === '1';

  return {
    kind: isTextBox || hasText ? 'textBox' : (preset ?? 'shape'),
    name: nonVisualProperties?.attributes.name,
    preset,
    geometry: parseGeometry(shapePropertyXml),
    fill: parseFill(shapePropertyXml, theme),
    stroke: parseStroke(shapePropertyXml, theme),
    textRuns: parseTextRuns(xml, theme),
  };
}

function parseConnector(xml: string, theme: ImportedTheme): ImportedShape {
  const nonVisualProperties = findStartTags(xml, 'cNvPr')[0];
  const shapeProperties = findFirstElement(xml, 'spPr');
  const shapePropertyXml = shapeProperties?.full ?? '';
  const preset = findStartTags(shapePropertyXml, 'prstGeom')[0]?.attributes.prst;

  return {
    kind: 'connector',
    name: nonVisualProperties?.attributes.name,
    preset,
    geometry: parseGeometry(shapePropertyXml),
    fill: parseFill(shapePropertyXml, theme),
    stroke: parseStroke(shapePropertyXml, theme),
    textRuns: parseTextRuns(xml, theme),
  };
}

function parsePicture(xml: string, theme: ImportedTheme): ImportedShape {
  const nonVisualProperties = findStartTags(xml, 'cNvPr')[0];
  const shapeProperties = findFirstElement(xml, 'spPr');
  const blip = findStartTags(xml, 'blip')[0];
  const relationshipId = blip?.attributes['r:embed'] ?? blip?.attributes.embed;

  return {
    kind: 'image',
    name: nonVisualProperties?.attributes.name,
    geometry: parseGeometry(shapeProperties?.full ?? ''),
    fill: parseFill(xml, theme),
    stroke: parseStroke(shapeProperties?.full ?? '', theme),
    textRuns: [],
    mediaRelationshipId: relationshipId,
  };
}

function parseGraphicFrame(xml: string): ImportedShape {
  const nonVisualProperties = findStartTags(xml, 'cNvPr')[0];

  return {
    kind: 'graphicFrame',
    name: nonVisualProperties?.attributes.name,
    geometry: parseGeometry(xml),
    textRuns: [],
  };
}

function parseSlideShapes(slideXml: string, theme: ImportedTheme): ImportedShape[] {
  const shapes: ImportedShape[] = [];
  const shapePattern = /<((?:[\w.-]+:)?(sp|cxnSp|pic|graphicFrame))\b[^>]*>[\s\S]*?<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = shapePattern.exec(slideXml)) !== null) {
    const [, , shapeType] = match;
    const shapeXml = match[0];

    switch (shapeType) {
      case 'cxnSp':
        shapes.push(parseConnector(shapeXml, theme));
        break;
      case 'graphicFrame':
        shapes.push(parseGraphicFrame(shapeXml));
        break;
      case 'pic':
        shapes.push(parsePicture(shapeXml, theme));
        break;
      default:
        shapes.push(parseShape(shapeXml, theme));
        break;
    }
  }

  return shapes;
}

function mediaKindFromRelationship(type: string): ImportedMedia['kind'] {
  const localType = type.split('/').at(-1);

  if (localType && MEDIA_KIND_BY_RELATIONSHIP.has(localType as 'audio' | 'image' | 'video')) {
    return MEDIA_KIND_BY_RELATIONSHIP.get(localType as 'audio' | 'image' | 'video') ?? 'unknown';
  }

  return 'unknown';
}

function extractSlideMedia(
  entries: ZipEntries,
  slidePath: string,
  slideIndex: number,
  contentTypes: ContentTypes,
): ImportedMedia[] {
  const relationshipXml = getXml(entries, relationshipPathFor(slidePath));

  if (!relationshipXml) {
    return [];
  }

  return parseRelationships(relationshipXml)
    .filter((relationship) => {
      const kind = mediaKindFromRelationship(relationship.type);
      return kind !== 'unknown' && relationship.targetMode !== 'External';
    })
    .flatMap((relationship) => {
      const mediaPath = resolvePackagePath(slidePath, relationship.target);
      const data = entries.get(mediaPath);

      if (!data) {
        return [];
      }

      const extension = path.posix.extname(mediaPath).slice(1).toLowerCase();

      return [
        {
          relationshipId: relationship.id,
          slideIndex,
          name: basename(mediaPath),
          path: mediaPath,
          kind: mediaKindFromRelationship(relationship.type),
          contentType: contentTypeFor(mediaPath, contentTypes),
          extension,
          data,
        },
      ];
    });
}

function relationshipPathFor(entryPath: string): string {
  return path.posix.join(
    path.posix.dirname(entryPath),
    '_rels',
    `${path.posix.basename(entryPath)}.rels`,
  );
}

function parseLayoutName(entries: ZipEntries, slidePath: string): string | undefined {
  const relationshipXml = getXml(entries, relationshipPathFor(slidePath));

  if (!relationshipXml) {
    return undefined;
  }

  const layoutRelationship = parseRelationships(relationshipXml).find((relationship) =>
    relationship.type.endsWith('/slideLayout'),
  );

  if (!layoutRelationship) {
    return undefined;
  }

  const layoutPath = resolvePackagePath(slidePath, layoutRelationship.target);
  const layoutXml = getXml(entries, layoutPath);

  return layoutXml ? findStartTags(layoutXml, 'cSld')[0]?.attributes.name : undefined;
}

function parseSlideOrder(entries: ZipEntries, presentationXml: string): string[] {
  const presentationRelationships = relationshipMap(
    parseRelationships(getRequiredXml(entries, 'ppt/_rels/presentation.xml.rels')),
  );
  const slidePaths = findStartTags(presentationXml, 'sldId')
    .map((slideId) => slideId.attributes['r:id'] ?? slideId.attributes.id)
    .map((relationshipId) =>
      relationshipId ? presentationRelationships.get(relationshipId) : undefined,
    )
    .filter((relationship) => relationship?.type.endsWith('/slide'))
    .map((relationship) => resolvePackagePath('ppt/presentation.xml', relationship?.target ?? ''));

  if (slidePaths.length > 0) {
    return slidePaths;
  }

  return [...entries.keys()]
    .filter((entryPath) => /^ppt\/slides\/slide\d+\.xml$/.test(entryPath))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function parseTitle(entries: ZipEntries, sourcePath: string): string {
  const coreProperties = getXml(entries, 'docProps/core.xml');
  const title = coreProperties ? textContent(coreProperties, 'title').trim() : '';

  return title.length > 0 ? title : path.basename(sourcePath, path.extname(sourcePath));
}

function collectRequiredFonts(presentation: ImportedPresentation): string[] {
  const fonts = new Set<string>();

  for (const font of [presentation.theme.fonts.majorLatin, presentation.theme.fonts.minorLatin]) {
    if (font) {
      fonts.add(font);
    }
  }

  for (const slide of presentation.slides) {
    for (const shape of slide.shapes) {
      for (const run of shape.textRuns) {
        if (run.fontFamily) {
          fonts.add(run.fontFamily);
        }
      }
    }
  }

  return [...fonts].sort((left, right) => left.localeCompare(right));
}

export function parsePptx(
  buffer: Buffer,
  sourcePath: string,
  options: ParsePptxOptions = {},
): ImportedPresentation {
  throwIfAborted(options.signal);
  report(options, {
    percent: 5,
    stage: 'reading',
    message: 'Reading PowerPoint archive',
  });

  const entries = readZipEntries(buffer);
  const presentationXml = getRequiredXml(entries, 'ppt/presentation.xml');
  const size = parseSlideSize(presentationXml);
  const theme = parseTheme(entries);
  const contentTypes = parseContentTypes(entries);
  const slidePaths = parseSlideOrder(entries, presentationXml);

  report(options, {
    percent: 15,
    stage: 'parsing',
    message: `Found ${slidePaths.length} slide${slidePaths.length === 1 ? '' : 's'}`,
    slideCount: slidePaths.length,
  });

  const slides: ImportedSlide[] = [];

  slidePaths.forEach((slidePath, slideIndex) => {
    throwIfAborted(options.signal);
    const slideXml = getRequiredXml(entries, slidePath);
    const background = findFirstElement(slideXml, 'bg');
    const slideNumber = slideIndex + 1;

    slides.push({
      sourceId: slidePath,
      order: slideIndex,
      layoutName: parseLayoutName(entries, slidePath),
      size,
      background: background ? parseFill(background.full, theme) : undefined,
      shapes: parseSlideShapes(slideXml, theme),
      media: extractSlideMedia(entries, slidePath, slideIndex, contentTypes),
    });

    report(options, {
      percent: 15 + Math.round((slideNumber / Math.max(slidePaths.length, 1)) * 70),
      stage: 'parsing',
      message: `Parsed slide ${slideNumber} of ${slidePaths.length}`,
      slideIndex: slideNumber,
      slideCount: slidePaths.length,
    });
  });

  const presentation: ImportedPresentation = {
    sourcePath,
    format: 'pptx',
    title: parseTitle(entries, sourcePath),
    size,
    theme,
    slides,
    requiredFonts: [],
    extractedAt: new Date().toISOString(),
  };

  presentation.requiredFonts = collectRequiredFonts(presentation);

  return presentation;
}
