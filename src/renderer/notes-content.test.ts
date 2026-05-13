import { describe, expect, it } from 'vitest';
import { noteResponseToHtml, plainTextToHtml } from './notes-content';

describe('notes content conversion', () => {
  it('escapes imported plain text and preserves paragraph breaks', () => {
    expect(plainTextToHtml('Welcome <trainer>\nMention Q&A')).toBe(
      '<p>Welcome &lt;trainer&gt;</p><p>Mention Q&amp;A</p>',
    );
  });

  it('uses saved editable HTML when present', () => {
    expect(
      noteResponseToHtml({
        contentJson: { html: '<p><strong>Saved</strong></p>', type: 'html' },
        plainText: 'Saved',
        presentationId: 1,
        slideId: 2,
      }),
    ).toBe('<p><strong>Saved</strong></p>');
  });

  it('falls back to plain text for imported notes without rich content', () => {
    expect(
      noteResponseToHtml({
        contentJson: {},
        plainText: 'Imported note',
        presentationId: 1,
        slideId: 2,
      }),
    ).toBe('<p>Imported note</p>');
  });
});
