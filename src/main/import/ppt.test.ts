import { describe, expect, it } from 'vitest';
import { parsePresentationBuffer } from './pipeline';
import { createLegacyPptBuffer } from './test-fixtures';

describe('legacy PPT import parsing', () => {
  it('extracts slide dimensions and text atoms from a legacy PowerPoint stream', () => {
    const presentation = parsePresentationBuffer(
      createLegacyPptBuffer(),
      '/tmp/legacy-training.ppt',
    );

    expect(presentation).toMatchObject({
      format: 'ppt',
      title: 'legacy-training',
      size: {
        widthEmu: 9_144_000,
        heightEmu: 6_858_000,
      },
    });
    expect(presentation.slides).toHaveLength(1);
    expect(presentation.slides[0]).toMatchObject({
      order: 0,
      sourceId: 'PowerPoint Document#1',
    });
    expect(presentation.slides[0].shapes[0].textRuns[0]).toMatchObject({
      content: 'Legacy slide text',
      bold: false,
      italic: false,
    });
  });

  it('rejects empty files before parsing', () => {
    expect(() => parsePresentationBuffer(Buffer.alloc(0), '/tmp/empty.ppt')).toThrow(
      'PowerPoint file is empty',
    );
  });
});
