import type { AppDatabase } from '../database';
import type { ImportedPresentation, PersistedImportResult } from './types';

type RunResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

function toRowId(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function stringifyJson(value: unknown | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export function persistImportedPresentation(
  database: AppDatabase,
  presentation: ImportedPresentation,
  missingFonts: string[],
): PersistedImportResult {
  const insert = database.transaction(() => {
    const insertPresentation = database.prepare(`
      INSERT INTO presentations (
        source_path,
        source_format,
        title,
        slide_width_emu,
        slide_height_emu
      )
      VALUES (@sourcePath, @format, @title, @widthEmu, @heightEmu)
    `);

    const insertTheme = database.prepare(`
      INSERT INTO presentation_themes (presentation_id, theme_json)
      VALUES (@presentationId, @themeJson)
    `);

    const insertSlide = database.prepare(`
      INSERT INTO slides (
        presentation_id,
        slide_order,
        source_id,
        layout_name,
        width_emu,
        height_emu,
        background_json
      )
      VALUES (
        @presentationId,
        @slideOrder,
        @sourceId,
        @layoutName,
        @widthEmu,
        @heightEmu,
        @backgroundJson
      )
    `);

    const insertShape = database.prepare(`
      INSERT INTO shapes (
        slide_id,
        shape_order,
        kind,
        name,
        preset,
        x_emu,
        y_emu,
        width_emu,
        height_emu,
        rotation,
        fill_json,
        stroke_json,
        media_relationship_id
      )
      VALUES (
        @slideId,
        @shapeOrder,
        @kind,
        @name,
        @preset,
        @xEmu,
        @yEmu,
        @widthEmu,
        @heightEmu,
        @rotation,
        @fillJson,
        @strokeJson,
        @mediaRelationshipId
      )
    `);

    const insertSlideNote = database.prepare(`
      INSERT INTO slide_notes (
        slide_id,
        presentation_id,
        content_json,
        plain_text
      )
      VALUES (
        @slideId,
        @presentationId,
        '{}',
        @plainText
      )
    `);

    const insertTextRun = database.prepare(`
      INSERT INTO text_runs (
        shape_id,
        run_order,
        content,
        font_family,
        font_size_pt,
        bold,
        italic,
        colour,
        alignment
      )
      VALUES (
        @shapeId,
        @runOrder,
        @content,
        @fontFamily,
        @fontSizePt,
        @bold,
        @italic,
        @colour,
        @alignment
      )
    `);

    const insertMedia = database.prepare(`
      INSERT INTO media (
        presentation_id,
        slide_id,
        relationship_id,
        name,
        path,
        kind,
        content_type,
        extension,
        data
      )
      VALUES (
        @presentationId,
        @slideId,
        @relationshipId,
        @name,
        @path,
        @kind,
        @contentType,
        @extension,
        @data
      )
    `);

    const insertFont = database.prepare(`
      INSERT INTO required_fonts (presentation_id, font_family, is_missing)
      VALUES (@presentationId, @fontFamily, @isMissing)
    `);

    const presentationResult = insertPresentation.run({
      sourcePath: presentation.sourcePath,
      format: presentation.format,
      title: presentation.title,
      widthEmu: presentation.size.widthEmu,
      heightEmu: presentation.size.heightEmu,
    }) as RunResult;

    const presentationId = toRowId(presentationResult.lastInsertRowid);

    insertTheme.run({
      presentationId,
      themeJson: JSON.stringify(presentation.theme),
    });

    const missingFontSet = new Set(missingFonts.map((font) => font.toLowerCase()));

    for (const fontFamily of presentation.requiredFonts) {
      insertFont.run({
        presentationId,
        fontFamily,
        isMissing: missingFontSet.has(fontFamily.toLowerCase()) ? 1 : 0,
      });
    }

    let mediaCount = 0;

    for (const slide of presentation.slides) {
      const slideResult = insertSlide.run({
        presentationId,
        slideOrder: slide.order,
        sourceId: slide.sourceId,
        layoutName: slide.layoutName ?? null,
        widthEmu: slide.size.widthEmu,
        heightEmu: slide.size.heightEmu,
        backgroundJson: stringifyJson(slide.background),
      }) as RunResult;

      const slideId = toRowId(slideResult.lastInsertRowid);
      const notes = slide.notes?.trim();

      if (notes && notes.length > 0) {
        insertSlideNote.run({
          slideId,
          presentationId,
          plainText: notes,
        });
      }

      slide.shapes.forEach((shape, shapeIndex) => {
        const shapeResult = insertShape.run({
          slideId,
          shapeOrder: shapeIndex,
          kind: shape.kind,
          name: shape.name ?? null,
          preset: shape.preset ?? null,
          xEmu: shape.geometry.xEmu ?? null,
          yEmu: shape.geometry.yEmu ?? null,
          widthEmu: shape.geometry.widthEmu ?? null,
          heightEmu: shape.geometry.heightEmu ?? null,
          rotation: shape.geometry.rotation ?? null,
          fillJson: stringifyJson(shape.fill),
          strokeJson: stringifyJson(shape.stroke),
          mediaRelationshipId: shape.mediaRelationshipId ?? null,
        }) as RunResult;

        const shapeId = toRowId(shapeResult.lastInsertRowid);

        shape.textRuns.forEach((run, runIndex) => {
          insertTextRun.run({
            shapeId,
            runOrder: runIndex,
            content: run.content,
            fontFamily: run.fontFamily ?? null,
            fontSizePt: run.fontSizePt ?? null,
            bold: run.bold ? 1 : 0,
            italic: run.italic ? 1 : 0,
            colour: run.colour ?? null,
            alignment: run.alignment ?? null,
          });
        });
      });

      for (const media of slide.media) {
        insertMedia.run({
          presentationId,
          slideId,
          relationshipId: media.relationshipId,
          name: media.name,
          path: media.path,
          kind: media.kind,
          contentType: media.contentType,
          extension: media.extension,
          data: media.data,
        });
        mediaCount += 1;
      }
    }

    return {
      presentationId,
      title: presentation.title,
      format: presentation.format,
      slideCount: presentation.slides.length,
      mediaCount,
      requiredFonts: presentation.requiredFonts,
      missingFonts,
    };
  });

  return insert() as PersistedImportResult;
}
