import { describe, expect, it, vi } from 'vitest';
import type { DrawingBrushSettings } from './drawing-canvas-model';
import {
  hasMinimumShapeSize,
  renderArrow,
  renderEllipse,
  renderLine,
  renderRectangle,
} from './shape-renderer';

const brush: DrawingBrushSettings = {
  globalCompositeOperation: 'source-over',
  lineCap: 'round',
  lineJoin: 'round',
  lineWidth: 3,
  strokeStyle: '#123456',
};

describe('shape renderer', () => {
  it('normalises rectangle coordinates for reverse drags', () => {
    const context = createMockShapeContext();

    expect(renderRectangle(context, { x: 50, y: 40 }, { x: 10, y: 5 }, brush)).toBe(true);

    expect(context.strokeRect).toHaveBeenCalledWith(10, 5, 40, 35);
    expect(context.strokeStyle).toBe('#123456');
    expect(context.lineWidth).toBe(3);
  });

  it('renders an ellipse inside the drag bounds', () => {
    const context = createMockShapeContext();

    expect(renderEllipse(context, { x: 10, y: 5 }, { x: 50, y: 40 }, brush)).toBe(true);

    expect(context.beginPath).toHaveBeenCalled();
    expect(context.ellipse).toHaveBeenCalledWith(30, 22.5, 20, 17.5, 0, 0, Math.PI * 2);
    expect(context.stroke).toHaveBeenCalled();
  });

  it('renders a line from start to end', () => {
    const context = createMockShapeContext();

    expect(renderLine(context, { x: 3, y: 4 }, { x: 33, y: 44 }, brush)).toBe(true);

    expect(context.moveTo).toHaveBeenCalledWith(3, 4);
    expect(context.lineTo).toHaveBeenCalledWith(33, 44);
    expect(context.stroke).toHaveBeenCalled();
  });

  it('renders an arrow line and filled arrowhead', () => {
    const context = createMockShapeContext();

    expect(renderArrow(context, { x: 0, y: 0 }, { x: 40, y: 0 }, brush)).toBe(true);

    expect(context.moveTo).toHaveBeenCalledWith(0, 0);
    expect(context.lineTo).toHaveBeenCalledWith(40, 0);
    expect(context.closePath).toHaveBeenCalled();
    expect(context.fillStyle).toBe('#123456');
    expect(context.fill).toHaveBeenCalled();
  });

  it('discards accidental tiny shapes', () => {
    const context = createMockShapeContext();

    expect(hasMinimumShapeSize({ x: 10, y: 10 }, { x: 13, y: 13 })).toBe(false);
    expect(renderLine(context, { x: 10, y: 10 }, { x: 13, y: 13 }, brush)).toBe(false);
    expect(context.stroke).not.toHaveBeenCalled();
  });
});

function createMockShapeContext() {
  return {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillStyle: '#000000',
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    lineTo: vi.fn(),
    lineWidth: 1,
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    strokeStyle: '#000000',
  } as unknown as CanvasRenderingContext2D;
}
