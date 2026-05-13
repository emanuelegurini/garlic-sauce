export const MAX_DRAWING_HISTORY_ENTRIES = 50;
export const DRAWING_TOOL_DRAG_MIME = 'application/x-garlic-drawing-tool';

export type CanvasSnapshot = string;

export type DrawingTool = 'arrow' | 'ellipse' | 'eraser' | 'line' | 'pen' | 'rectangle';
export type PlaceableDrawingTool = Extract<DrawingTool, 'arrow' | 'ellipse' | 'line' | 'rectangle'>;
export type DrawingShapeTool = PlaceableDrawingTool;

export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingBrushSettings = {
  globalCompositeOperation: GlobalCompositeOperation;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  strokeStyle: string;
};

export type DrawingHistoryState = {
  redoStack: CanvasSnapshot[];
  undoStack: CanvasSnapshot[];
};

export type DrawingShapeElement = {
  colour: string;
  height: number;
  id: string;
  lineWidth: number;
  tool: DrawingShapeTool;
  type: 'shape';
  width: number;
  x: number;
  y: number;
};

export type DrawingElement = DrawingShapeElement;

export type StrokeCommand =
  | {
      type: 'beginPath' | 'stroke';
    }
  | {
      point: DrawingPoint;
      type: 'lineTo' | 'moveTo';
    };

export type ContainedRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export function getDrawingBrushSettings(options: {
  eraserRadius: number;
  penColour: string;
  penWidth: number;
  tool: DrawingTool;
}): DrawingBrushSettings {
  if (options.tool === 'eraser') {
    return {
      globalCompositeOperation: 'destination-out',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: options.eraserRadius * 2,
      strokeStyle: '#000000',
    };
  }

  return {
    globalCompositeOperation: 'source-over',
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: options.penWidth,
    strokeStyle: options.penColour,
  };
}

export function isPlaceableDrawingTool(tool: string): tool is PlaceableDrawingTool {
  return tool === 'rectangle' || tool === 'ellipse' || tool === 'arrow' || tool === 'line';
}

export function addUndoSnapshot(
  state: DrawingHistoryState,
  snapshot: CanvasSnapshot,
): DrawingHistoryState {
  return {
    redoStack: [],
    undoStack: [...state.undoStack, snapshot].slice(-MAX_DRAWING_HISTORY_ENTRIES),
  };
}

export function applyUndoSnapshot(
  state: DrawingHistoryState,
  currentSnapshot: CanvasSnapshot,
): DrawingHistoryState {
  if (state.undoStack.length === 0) {
    return state;
  }

  return {
    redoStack: [...state.redoStack, currentSnapshot].slice(-MAX_DRAWING_HISTORY_ENTRIES),
    undoStack: state.undoStack.slice(0, -1),
  };
}

export function applyRedoSnapshot(
  state: DrawingHistoryState,
  currentSnapshot: CanvasSnapshot,
): DrawingHistoryState {
  if (state.redoStack.length === 0) {
    return state;
  }

  return {
    redoStack: state.redoStack.slice(0, -1),
    undoStack: [...state.undoStack, currentSnapshot].slice(-MAX_DRAWING_HISTORY_ENTRIES),
  };
}

export function buildStrokePath(points: DrawingPoint[]): StrokeCommand[] {
  if (points.length === 0) {
    return [];
  }

  const [firstPoint, ...remainingPoints] = points;

  return [
    { type: 'beginPath' },
    { point: firstPoint, type: 'moveTo' },
    ...remainingPoints.map((point): StrokeCommand => ({ point, type: 'lineTo' })),
    { type: 'stroke' },
  ];
}

export function applyBrushSettings(
  context: Pick<
    CanvasRenderingContext2D,
    'globalCompositeOperation' | 'lineCap' | 'lineJoin' | 'lineWidth' | 'strokeStyle'
  >,
  settings: DrawingBrushSettings,
): void {
  context.globalCompositeOperation = settings.globalCompositeOperation;
  context.lineCap = settings.lineCap;
  context.lineJoin = settings.lineJoin;
  context.lineWidth = settings.lineWidth;
  context.strokeStyle = settings.strokeStyle;
}

export function applyStrokeCommands(
  context: Pick<CanvasRenderingContext2D, 'beginPath' | 'lineTo' | 'moveTo' | 'stroke'>,
  commands: StrokeCommand[],
): void {
  for (const command of commands) {
    if (command.type === 'beginPath') {
      context.beginPath();
    } else if (command.type === 'moveTo') {
      context.moveTo(command.point.x, command.point.y);
    } else if (command.type === 'lineTo') {
      context.lineTo(command.point.x, command.point.y);
    } else {
      context.stroke();
    }
  }
}

export function calculateContainedRect(options: {
  containerHeight: number;
  containerWidth: number;
  contentHeight: number;
  contentWidth: number;
}): ContainedRect {
  const containerWidth = Math.max(0, options.containerWidth);
  const containerHeight = Math.max(0, options.containerHeight);
  const contentWidth = Math.max(1, options.contentWidth);
  const contentHeight = Math.max(1, options.contentHeight);
  const scale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
  const width = Math.max(1, contentWidth * scale);
  const height = Math.max(1, contentHeight * scale);

  return {
    height,
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
  };
}

export function getCanvasPoint(
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
  rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
): DrawingPoint {
  const scaleX = rect.width > 0 ? rect.width : 1;
  const scaleY = rect.height > 0 ? rect.height : 1;

  return {
    x: Math.max(0, Math.min(scaleX, event.clientX - rect.left)),
    y: Math.max(0, Math.min(scaleY, event.clientY - rect.top)),
  };
}
