import { describe, expect, it } from 'vitest';
import { getCurrentSlideViewerState } from './SlideViewer';

type SlideViewerState = Parameters<typeof getCurrentSlideViewerState>[0];

const readyState: SlideViewerState = {
  image: {
    dataUrl: 'data:image/png;base64,image',
    found: true,
    heightPx: 720,
    widthPx: 1280,
  },
  presentationId: 1,
  slideOrder: 0,
  status: 'ready',
};

describe('SlideViewer state selection', () => {
  it('uses a ready slide image only for the current slide', () => {
    expect(getCurrentSlideViewerState(readyState, 1, 0)).toBe(readyState);
    expect(getCurrentSlideViewerState(readyState, 1, 1)).toEqual({
      status: 'loading',
    });
  });

  it('does not show a stale slide error while another slide is loading', () => {
    expect(
      getCurrentSlideViewerState(
        {
          message: 'Old slide failed',
          presentationId: 1,
          slideOrder: 0,
          status: 'error',
        },
        1,
        1,
      ),
    ).toEqual({
      status: 'loading',
    });
  });
});
