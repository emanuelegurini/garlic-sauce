import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DrawingCanvas,
  getDrawingCanvasCursor,
  getDrawingCanvasPointerEvents,
  getDroppedShapePoints,
} from './DrawingCanvas';

const defaultProps = {
  activeTool: 'pen' as const,
  clearRequestId: 0,
  eraserRadius: 20,
  isDrawingMode: false,
  penColour: '#FF0000',
  penWidth: 3,
  slideHeightPx: 720,
  slideId: 1,
  slideWidthPx: 1280,
};

describe('DrawingCanvas', () => {
  it('mounts as an aria-hidden canvas with pointer events disabled when drawing mode is off', () => {
    const markup = renderToStaticMarkup(createElement(DrawingCanvas, defaultProps));

    expect(markup).toContain('<canvas');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('pointer-events:none');
    expect(getDrawingCanvasPointerEvents(false)).toBe('none');
  });

  it('enables pointer events when drawing mode is on', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingCanvas, {
        ...defaultProps,
        isDrawingMode: true,
      }),
    );

    expect(markup).toContain('pointer-events:auto');
    expect(getDrawingCanvasPointerEvents(true)).toBe('auto');
  });

  it('uses tool-specific cursors while drawing mode is active', () => {
    expect(getDrawingCanvasCursor(false, 'pen')).toBe('default');
    expect(getDrawingCanvasCursor(true, 'pen')).toBe('crosshair');
    expect(getDrawingCanvasCursor(true, 'rectangle')).toBe('crosshair');
    expect(getDrawingCanvasCursor(true, 'eraser')).toBe('none');
  });

  it('centres dropped shapes on the drop point while staying inside the canvas', () => {
    expect(
      getDroppedShapePoints({
        canvasHeight: 300,
        canvasWidth: 400,
        point: {
          x: 390,
          y: 290,
        },
        tool: 'rectangle',
      }),
    ).toEqual({
      endPoint: {
        x: 400,
        y: 300,
      },
      startPoint: {
        x: 220,
        y: 190,
      },
    });
  });
});
