import {
  applyBrushSettings,
  type DrawingBrushSettings,
  type DrawingPoint,
} from './drawing-canvas-model';
import type { DrawingTool } from './drawing-canvas-model';

export const MIN_SHAPE_SIZE_PX = 4;

export type ShapeTool = Extract<DrawingTool, 'arrow' | 'ellipse' | 'line' | 'rectangle'>;

type ShapeContext = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'closePath'
  | 'ellipse'
  | 'fill'
  | 'fillStyle'
  | 'globalCompositeOperation'
  | 'lineCap'
  | 'lineJoin'
  | 'lineTo'
  | 'lineWidth'
  | 'moveTo'
  | 'restore'
  | 'save'
  | 'stroke'
  | 'strokeRect'
  | 'strokeStyle'
>;

type NormalizedBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export function isShapeTool(tool: DrawingTool): tool is ShapeTool {
  return tool === 'rectangle' || tool === 'ellipse' || tool === 'arrow' || tool === 'line';
}

export function hasMinimumShapeSize(startPoint: DrawingPoint, endPoint: DrawingPoint): boolean {
  return (
    Math.abs(endPoint.x - startPoint.x) >= MIN_SHAPE_SIZE_PX ||
    Math.abs(endPoint.y - startPoint.y) >= MIN_SHAPE_SIZE_PX
  );
}

export function normalizeShapeBounds(
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
): NormalizedBounds {
  const left = Math.min(startPoint.x, endPoint.x);
  const top = Math.min(startPoint.y, endPoint.y);

  return {
    height: Math.abs(endPoint.y - startPoint.y),
    left,
    top,
    width: Math.abs(endPoint.x - startPoint.x),
  };
}

export function renderRectangle(
  context: ShapeContext,
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
  brush: DrawingBrushSettings,
): boolean {
  if (!hasMinimumShapeSize(startPoint, endPoint)) {
    return false;
  }

  const bounds = normalizeShapeBounds(startPoint, endPoint);
  withBrush(context, brush, () => {
    context.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
  });

  return true;
}

export function renderEllipse(
  context: ShapeContext,
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
  brush: DrawingBrushSettings,
): boolean {
  if (!hasMinimumShapeSize(startPoint, endPoint)) {
    return false;
  }

  const bounds = normalizeShapeBounds(startPoint, endPoint);
  withBrush(context, brush, () => {
    context.beginPath();
    context.ellipse(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
      bounds.width / 2,
      bounds.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  });

  return true;
}

export function renderLine(
  context: ShapeContext,
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
  brush: DrawingBrushSettings,
): boolean {
  if (!hasMinimumShapeSize(startPoint, endPoint)) {
    return false;
  }

  withBrush(context, brush, () => {
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  });

  return true;
}

export function renderArrow(
  context: ShapeContext,
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
  brush: DrawingBrushSettings,
): boolean {
  if (!hasMinimumShapeSize(startPoint, endPoint)) {
    return false;
  }

  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
  const arrowheadLength = Math.max(8, brush.lineWidth * 4);
  const arrowheadSpread = Math.PI / 7;

  withBrush(context, brush, () => {
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();

    context.beginPath();
    context.moveTo(endPoint.x, endPoint.y);
    context.lineTo(
      endPoint.x - arrowheadLength * Math.cos(angle - arrowheadSpread),
      endPoint.y - arrowheadLength * Math.sin(angle - arrowheadSpread),
    );
    context.lineTo(
      endPoint.x - arrowheadLength * Math.cos(angle + arrowheadSpread),
      endPoint.y - arrowheadLength * Math.sin(angle + arrowheadSpread),
    );
    context.closePath();
    context.fillStyle = brush.strokeStyle;
    context.fill();
  });

  return true;
}

export function renderShape(
  context: ShapeContext,
  tool: ShapeTool,
  startPoint: DrawingPoint,
  endPoint: DrawingPoint,
  brush: DrawingBrushSettings,
): boolean {
  switch (tool) {
    case 'arrow':
      return renderArrow(context, startPoint, endPoint, brush);
    case 'ellipse':
      return renderEllipse(context, startPoint, endPoint, brush);
    case 'line':
      return renderLine(context, startPoint, endPoint, brush);
    case 'rectangle':
      return renderRectangle(context, startPoint, endPoint, brush);
  }
}

function withBrush(context: ShapeContext, brush: DrawingBrushSettings, render: () => void): void {
  context.save();
  applyBrushSettings(context, brush);
  render();
  context.restore();
}
