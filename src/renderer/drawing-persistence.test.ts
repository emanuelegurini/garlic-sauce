import { describe, expect, it, vi } from 'vitest';
import {
  createDrawingSaveDebouncer,
  syncDrawingSlide,
  type DrawingSavePayload,
} from './drawing-persistence';

describe('drawing persistence helpers', () => {
  it('debounces drawing saves and keeps only the latest payload', async () => {
    vi.useFakeTimers();
    const saves: DrawingSavePayload[] = [];
    const debouncer = createDrawingSaveDebouncer((payload) => {
      saves.push(payload);
    }, 500);

    debouncer.schedule({
      canvasData: 'first',
      elementsJson: [],
      slideId: 1,
    });
    debouncer.schedule({
      canvasData: 'second',
      elementsJson: [],
      slideId: 1,
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([
      {
        canvasData: 'second',
        elementsJson: [],
        slideId: 1,
      },
    ]);

    vi.useRealTimers();
  });

  it('flushes pending drawing saves before navigation', async () => {
    vi.useFakeTimers();
    const saves: DrawingSavePayload[] = [];
    const debouncer = createDrawingSaveDebouncer((payload) => {
      saves.push(payload);
    }, 500);

    debouncer.schedule({
      canvasData: 'pending',
      elementsJson: [],
      slideId: 2,
    });

    await debouncer.flush();

    expect(saves).toEqual([
      {
        canvasData: 'pending',
        elementsJson: [],
        slideId: 2,
      },
    ]);

    await vi.advanceTimersByTimeAsync(500);
    expect(saves).toHaveLength(1);

    vi.useRealTimers();
  });

  it('saves the previous dirty slide and restores the next slide on navigation', async () => {
    const calls: string[] = [];

    await syncDrawingSlide({
      captureCanvasData: () => 'old-slide-png',
      captureElementsJson: () => [{ id: 'shape' }] as unknown as GarlicSauceDrawingElement[],
      clearCanvas: () => calls.push('clear'),
      clearElements: () => calls.push('clear-elements'),
      isDirty: true,
      loadDrawing: async (slideId) => {
        calls.push(`load:${slideId}`);
        return createDrawing('next-slide-png');
      },
      nextSlideId: 12,
      previousSlideId: 10,
      restoreDrawing: async (drawing) => {
        calls.push(`restore:${drawing.canvasData}`);
      },
      saveDrawing: async (slideId, canvasData, elementsJson) => {
        calls.push(`save:${slideId}:${canvasData}:${elementsJson.length}`);
      },
    });

    expect(calls).toEqual([
      'save:10:old-slide-png:1',
      'clear',
      'clear-elements',
      'load:12',
      'restore:next-slide-png',
    ]);
  });

  it('does not save a clean previous slide during navigation', async () => {
    const calls: string[] = [];

    await syncDrawingSlide({
      captureCanvasData: () => 'unused',
      captureElementsJson: () => [],
      clearCanvas: () => calls.push('clear'),
      clearElements: () => calls.push('clear-elements'),
      isDirty: false,
      loadDrawing: async (slideId) => {
        calls.push(`load:${slideId}`);
        return null;
      },
      nextSlideId: 4,
      previousSlideId: 3,
      restoreDrawing: async () => {
        calls.push('restore');
      },
      saveDrawing: async () => {
        calls.push('save');
      },
    });

    expect(calls).toEqual(['clear', 'clear-elements', 'load:4']);
  });

  it('round-trips rasterized drawing canvas data across navigation', async () => {
    const savedDrawings = new Map<number, GarlicSauceSlideDrawing>([
      [1, createDrawing('data:image/png;base64,drawing-canvas')],
    ]);
    const calls: string[] = [];

    await syncDrawingSlide({
      captureCanvasData: () => 'data:image/png;base64,drawing-canvas',
      captureElementsJson: () => [{ id: 'rectangle' }] as unknown as GarlicSauceDrawingElement[],
      clearCanvas: () => calls.push('clear'),
      clearElements: () => calls.push('clear-elements'),
      isDirty: true,
      loadDrawing: async (slideId) => {
        calls.push(`load:${slideId}`);
        return savedDrawings.get(slideId) ?? null;
      },
      nextSlideId: 1,
      previousSlideId: 2,
      restoreDrawing: async (drawing) => {
        calls.push(`restore:${drawing.canvasData}:${drawing.elementsJson.length}`);
      },
      saveDrawing: async (slideId, canvasData, elementsJson) => {
        savedDrawings.set(slideId, createDrawing(canvasData, elementsJson));
        calls.push(`save:${slideId}:${canvasData}:${elementsJson.length}`);
      },
    });

    expect(savedDrawings.get(2)).toMatchObject({
      canvasData: 'data:image/png;base64,drawing-canvas',
      elementsJson: [{ id: 'rectangle' }],
    });
    expect(calls).toEqual([
      'save:2:data:image/png;base64,drawing-canvas:1',
      'clear',
      'clear-elements',
      'load:1',
      'restore:data:image/png;base64,drawing-canvas:0',
    ]);
  });
});

function createDrawing(
  canvasData: string,
  elementsJson: GarlicSauceDrawingElement[] = [],
): GarlicSauceSlideDrawing {
  return {
    canvasData,
    elementsJson,
    presentationId: 1,
    slideId: 1,
    updatedAt: '2026-05-14T00:00:00.000Z',
  };
}
