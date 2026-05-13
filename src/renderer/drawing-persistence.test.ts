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
      slideId: 1,
    });
    debouncer.schedule({
      canvasData: 'second',
      slideId: 1,
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([
      {
        canvasData: 'second',
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
      slideId: 2,
    });

    await debouncer.flush();

    expect(saves).toEqual([
      {
        canvasData: 'pending',
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
      clearCanvas: () => calls.push('clear'),
      isDirty: true,
      loadDrawing: async (slideId) => {
        calls.push(`load:${slideId}`);
        return 'next-slide-png';
      },
      nextSlideId: 12,
      previousSlideId: 10,
      restoreDrawing: async (canvasData) => {
        calls.push(`restore:${canvasData}`);
      },
      saveDrawing: async (slideId, canvasData) => {
        calls.push(`save:${slideId}:${canvasData}`);
      },
    });

    expect(calls).toEqual(['save:10:old-slide-png', 'clear', 'load:12', 'restore:next-slide-png']);
  });

  it('does not save a clean previous slide during navigation', async () => {
    const calls: string[] = [];

    await syncDrawingSlide({
      captureCanvasData: () => 'unused',
      clearCanvas: () => calls.push('clear'),
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

    expect(calls).toEqual(['clear', 'load:4']);
  });
});
