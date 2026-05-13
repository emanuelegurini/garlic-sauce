import { describe, expect, it } from 'vitest';
import {
  chooseVisibleSlideOrder,
  createSlideNavigationState,
  getAdjacentVisibleSlideOrder,
  getNavigationKeyAction,
  shouldIgnoreNavigationKeyTarget,
  type SlideNavigationSlide,
} from './useSlideNavigation';

const slides: SlideNavigationSlide[] = [
  { hidden: false, slideOrder: 0 },
  { hidden: true, slideOrder: 1 },
  { hidden: false, slideOrder: 2 },
  { hidden: false, slideOrder: 3 },
];

describe('useSlideNavigation logic', () => {
  it('skips hidden slides when moving next and previous', () => {
    expect(getAdjacentVisibleSlideOrder(slides, 0, 'next')).toBe(2);
    expect(getAdjacentVisibleSlideOrder(slides, 2, 'prev')).toBe(0);
  });

  it('keeps navigation inside the first and last visible slide boundaries', () => {
    expect(getAdjacentVisibleSlideOrder(slides, 0, 'prev')).toBe(0);
    expect(getAdjacentVisibleSlideOrder(slides, 3, 'next')).toBe(3);

    expect(createSlideNavigationState(slides, 0)).toMatchObject({
      canGoNext: true,
      canGoPrev: false,
      currentVisiblePosition: 1,
      visibleSlideCount: 3,
    });
    expect(createSlideNavigationState(slides, 3)).toMatchObject({
      canGoNext: false,
      canGoPrev: true,
      currentVisiblePosition: 3,
      visibleSlideCount: 3,
    });
  });

  it('advances to the next visible slide when the current slide is hidden', () => {
    expect(chooseVisibleSlideOrder(slides, 1)).toBe(2);
    expect(
      chooseVisibleSlideOrder(
        [
          { hidden: false, slideOrder: 0 },
          { hidden: true, slideOrder: 1 },
        ],
        1,
      ),
    ).toBe(0);
  });

  it('reports the all-hidden sentinel state', () => {
    expect(
      createSlideNavigationState(
        [
          { hidden: true, slideOrder: 0 },
          { hidden: true, slideOrder: 1 },
        ],
        0,
      ),
    ).toEqual({
      allSlidesHidden: true,
      canGoNext: false,
      canGoPrev: false,
      currentSlideOrder: null,
      currentVisiblePosition: 0,
      slideCount: 2,
      visibleSlideCount: 0,
    });
  });

  it('maps arrow keys and spacebar to navigation actions', () => {
    expect(getNavigationKeyAction({ key: 'ArrowRight', target: null })).toBe('next');
    expect(getNavigationKeyAction({ key: 'ArrowLeft', target: null })).toBe('prev');
    expect(getNavigationKeyAction({ key: ' ', target: null })).toBe('next');
    expect(getNavigationKeyAction({ key: 'Spacebar', target: null })).toBe('next');
    expect(getNavigationKeyAction({ key: 'Enter', target: null })).toBeUndefined();
  });

  it('ignores keyboard navigation while editable elements are focused', () => {
    const inputTarget = { tagName: 'input' } as unknown as EventTarget;
    const editableTarget = {
      getAttribute: (name: string) => (name === 'role' ? 'textbox' : null),
      tagName: 'div',
    } as unknown as EventTarget;

    expect(shouldIgnoreNavigationKeyTarget(inputTarget)).toBe(true);
    expect(shouldIgnoreNavigationKeyTarget(editableTarget)).toBe(true);
    expect(getNavigationKeyAction({ key: 'ArrowRight', target: inputTarget })).toBeUndefined();
  });
});
