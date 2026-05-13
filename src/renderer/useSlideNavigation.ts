import { useCallback, useEffect, useMemo, useState } from 'react';

export type SlideNavigationSlide = {
  hidden: boolean;
  slideOrder: number;
};

export type SlideNavigationState = {
  allSlidesHidden: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  currentSlideOrder: number | null;
  currentVisiblePosition: number;
  slideCount: number;
  visibleSlideCount: number;
};

export type SlideNavigation = SlideNavigationState & {
  goNext: () => void;
  goPrev: () => void;
  goTo: (slideOrder: number) => void;
};

export type NavigationKeyAction = 'next' | 'prev';

export function createSlideNavigationState(
  slides: SlideNavigationSlide[],
  requestedSlideOrder: number | null,
): SlideNavigationState {
  const visibleSlides = getVisibleSlides(slides);
  const currentSlideOrder = chooseVisibleSlideOrder(slides, requestedSlideOrder);
  const currentVisibleIndex =
    currentSlideOrder === null
      ? -1
      : visibleSlides.findIndex((slide) => slide.slideOrder === currentSlideOrder);

  return {
    allSlidesHidden: slides.length > 0 && visibleSlides.length === 0,
    canGoNext: currentVisibleIndex >= 0 && currentVisibleIndex < visibleSlides.length - 1,
    canGoPrev: currentVisibleIndex > 0,
    currentSlideOrder,
    currentVisiblePosition: currentVisibleIndex >= 0 ? currentVisibleIndex + 1 : 0,
    slideCount: slides.length,
    visibleSlideCount: visibleSlides.length,
  };
}

export function chooseVisibleSlideOrder(
  slides: SlideNavigationSlide[],
  requestedSlideOrder: number | null,
): number | null {
  const visibleSlides = getVisibleSlides(slides);

  if (visibleSlides.length === 0) {
    return null;
  }

  if (requestedSlideOrder === null) {
    return visibleSlides[0].slideOrder;
  }

  if (visibleSlides.some((slide) => slide.slideOrder === requestedSlideOrder)) {
    return requestedSlideOrder;
  }

  const nextVisibleSlide = visibleSlides.find((slide) => slide.slideOrder > requestedSlideOrder);

  if (nextVisibleSlide) {
    return nextVisibleSlide.slideOrder;
  }

  for (let index = visibleSlides.length - 1; index >= 0; index -= 1) {
    if (visibleSlides[index].slideOrder < requestedSlideOrder) {
      return visibleSlides[index].slideOrder;
    }
  }

  return visibleSlides[0].slideOrder;
}

export function getAdjacentVisibleSlideOrder(
  slides: SlideNavigationSlide[],
  requestedSlideOrder: number | null,
  direction: NavigationKeyAction,
): number | null {
  const visibleSlides = getVisibleSlides(slides);
  const currentSlideOrder = chooseVisibleSlideOrder(slides, requestedSlideOrder);

  if (currentSlideOrder === null) {
    return null;
  }

  const currentIndex = visibleSlides.findIndex((slide) => slide.slideOrder === currentSlideOrder);

  if (currentIndex < 0) {
    return visibleSlides[0]?.slideOrder ?? null;
  }

  const nextIndex =
    direction === 'next'
      ? Math.min(currentIndex + 1, visibleSlides.length - 1)
      : Math.max(currentIndex - 1, 0);

  return visibleSlides[nextIndex].slideOrder;
}

export function getNavigationKeyAction(
  event: Pick<KeyboardEvent, 'key' | 'target'>,
): NavigationKeyAction | undefined {
  if (shouldIgnoreNavigationKeyTarget(event.target)) {
    return undefined;
  }

  if (event.key === 'ArrowRight') {
    return 'next';
  }

  if (event.key === 'ArrowLeft') {
    return 'prev';
  }

  return undefined;
}

export function shouldIgnoreNavigationKeyTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const element = target as {
    getAttribute?: (name: string) => string | null;
    isContentEditable?: boolean;
    tagName?: string;
  };
  const tagName = element.tagName?.toUpperCase();

  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    element.isContentEditable === true ||
    element.getAttribute?.('contenteditable') === 'true' ||
    element.getAttribute?.('role') === 'textbox'
  );
}

export function useSlideNavigation(slides: SlideNavigationSlide[]): SlideNavigation {
  const [requestedSlideOrder, setRequestedSlideOrder] = useState<number | null>(null);

  useEffect(() => {
    setRequestedSlideOrder((currentSlideOrder) =>
      chooseVisibleSlideOrder(slides, currentSlideOrder),
    );
  }, [slides]);

  const state = useMemo(
    () => createSlideNavigationState(slides, requestedSlideOrder),
    [requestedSlideOrder, slides],
  );

  const goNext = useCallback(() => {
    setRequestedSlideOrder((currentSlideOrder) =>
      getAdjacentVisibleSlideOrder(slides, currentSlideOrder, 'next'),
    );
  }, [slides]);

  const goPrev = useCallback(() => {
    setRequestedSlideOrder((currentSlideOrder) =>
      getAdjacentVisibleSlideOrder(slides, currentSlideOrder, 'prev'),
    );
  }, [slides]);

  const goTo = useCallback(
    (slideOrder: number) => {
      const target = slides.find((slide) => slide.slideOrder === slideOrder);

      if (target && !target.hidden) {
        setRequestedSlideOrder(slideOrder);
      }
    },
    [slides],
  );

  return {
    ...state,
    goNext,
    goPrev,
    goTo,
  };
}

function getVisibleSlides(slides: SlideNavigationSlide[]): SlideNavigationSlide[] {
  return [...slides]
    .sort((left, right) => left.slideOrder - right.slideOrder)
    .filter((slide) => !slide.hidden);
}
