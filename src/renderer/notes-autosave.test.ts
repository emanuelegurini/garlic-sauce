import { describe, expect, it, vi } from 'vitest';
import { createNotesSaveDebouncer, type NotesSavePayload } from './notes-autosave';

describe('notes autosave debouncer', () => {
  it('collapses rapid edits into a single save call', async () => {
    vi.useFakeTimers();
    const saves: NotesSavePayload[] = [];
    const debouncer = createNotesSaveDebouncer((payload) => {
      saves.push(payload);
    }, 500);

    debouncer.schedule({
      contentJson: { html: '<p>A</p>', type: 'html' },
      plainText: 'A',
      slideId: 1,
    });
    debouncer.schedule({
      contentJson: { html: '<p>AB</p>', type: 'html' },
      plainText: 'AB',
      slideId: 1,
    });
    debouncer.schedule({
      contentJson: { html: '<p>ABC</p>', type: 'html' },
      plainText: 'ABC',
      slideId: 1,
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([
      {
        contentJson: { html: '<p>ABC</p>', type: 'html' },
        plainText: 'ABC',
        slideId: 1,
      },
    ]);

    vi.useRealTimers();
  });

  it('flushes a pending save immediately before slide changes', async () => {
    vi.useFakeTimers();
    const saves: NotesSavePayload[] = [];
    const debouncer = createNotesSaveDebouncer((payload) => {
      saves.push(payload);
    }, 500);

    debouncer.schedule({
      contentJson: { html: '<p>Before navigation</p>', type: 'html' },
      plainText: 'Before navigation',
      slideId: 2,
    });

    await debouncer.flush();

    expect(saves).toEqual([
      {
        contentJson: { html: '<p>Before navigation</p>', type: 'html' },
        plainText: 'Before navigation',
        slideId: 2,
      },
    ]);

    await vi.advanceTimersByTimeAsync(500);
    expect(saves).toHaveLength(1);

    vi.useRealTimers();
  });
});
