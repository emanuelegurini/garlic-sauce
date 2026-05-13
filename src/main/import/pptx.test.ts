import { describe, expect, it } from 'vitest';
import { parsePresentationBuffer } from './pipeline';
import { createLayoutBackedPptx, createNotesPptx, createSamplePptx } from './test-fixtures';

describe('PPTX import parsing', () => {
  it('extracts slide order, dimensions, text formatting, theme colours, and media', () => {
    const presentation = parsePresentationBuffer(
      createSamplePptx(),
      '/tmp/quarterly-training.pptx',
    );

    expect(presentation).toMatchObject({
      format: 'pptx',
      title: 'Quarterly Training',
      size: {
        widthEmu: 12_192_000,
        heightEmu: 6_858_000,
      },
    });
    expect(presentation.theme.colours.accent1).toBe('#1D5F5B');
    expect(presentation.requiredFonts).toContain('Aptos');
    expect(presentation.slides).toHaveLength(1);
    expect(presentation.slides[0]).toMatchObject({
      order: 0,
      sourceId: 'ppt/slides/slide1.xml',
      layoutName: 'Title Slide',
      background: {
        kind: 'solid',
        colour: '#F7F8FA',
      },
    });

    const textShape = presentation.slides[0].shapes.find((shape) => shape.kind === 'textBox');
    expect(textShape).toMatchObject({
      name: 'Title 1',
      preset: 'rect',
      geometry: {
        xEmu: 914_400,
        yEmu: 685_800,
        widthEmu: 5_486_400,
        heightEmu: 914_400,
      },
      fill: {
        kind: 'solid',
        colour: '#1D5F5B',
      },
    });
    expect(textShape?.textRuns).toEqual([
      {
        content: 'Hello & welcome',
        fontFamily: 'Aptos',
        fontSizePt: 24,
        bold: true,
        italic: false,
        colour: '#FFFFFF',
        alignment: 'ctr',
      },
    ]);

    const imageShape = presentation.slides[0].shapes.find((shape) => shape.kind === 'image');
    expect(imageShape?.mediaRelationshipId).toBe('rIdImage1');
    expect(presentation.slides[0].media).toHaveLength(1);
    expect(presentation.slides[0].media[0]).toMatchObject({
      relationshipId: 'rIdImage1',
      name: 'image1.png',
      kind: 'image',
      contentType: 'image/png',
      extension: 'png',
    });
    expect([...presentation.slides[0].media[0].data]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('rejects corrupt PPTX archives with a user-facing error', () => {
    expect(() =>
      parsePresentationBuffer(Buffer.from('not a zip archive'), '/tmp/corrupt.pptx'),
    ).toThrow('valid ZIP archive');
  });

  it('merges slide layout visuals and placeholder geometry into slides', () => {
    const presentation = parsePresentationBuffer(createLayoutBackedPptx(), '/tmp/layout.pptx');
    const slide = presentation.slides[0];
    const background = slide.shapes.find((shape) => shape.kind === 'image');
    const title = slide.shapes.find((shape) =>
      shape.textRuns.some((run) => run.content === 'Layout title text'),
    );

    expect(presentation.theme.colours).toMatchObject({
      bg1: '#000000',
      tx1: '#FFFFFF',
      tx2: '#F1F3F3',
    });
    expect(slide.layoutName).toBe('Title Slide');
    expect(background).toMatchObject({
      mediaRelationshipId: 'layout:ppt/slideLayouts/slideLayout1.xml:rIdLayoutImage',
      geometry: {
        xEmu: 0,
        yEmu: 0,
        widthEmu: 12_192_000,
        heightEmu: 6_858_000,
      },
    });
    expect(slide.media[0]).toMatchObject({
      relationshipId: 'layout:ppt/slideLayouts/slideLayout1.xml:rIdLayoutImage',
      name: 'layout-background.png',
    });
    expect(title).toMatchObject({
      geometry: {
        xEmu: 914_400,
        yEmu: 685_800,
        widthEmu: 5_486_400,
        heightEmu: 914_400,
      },
    });
    expect(title?.textRuns[0]).toMatchObject({
      content: 'Layout title text',
      colour: '#FFFFFF',
      fontSizePt: 48,
    });
    expect(
      slide.shapes.some(
        (shape) => shape.name === 'Title 1' && shape.textRuns[0]?.content === 'Layout title prompt',
      ),
    ).toBe(false);
  });

  it('extracts presenter notes from related notes slide parts', () => {
    const presentation = parsePresentationBuffer(createNotesPptx(), '/tmp/notes.pptx');

    expect(presentation.slides).toHaveLength(2);
    expect(presentation.slides[0].notes).toBe('Welcome the room\nMention safety setup');
    expect(presentation.slides[1].notes).toBeUndefined();
  });
});
