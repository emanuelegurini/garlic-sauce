import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  applyBrushSettings,
  calculateContainedRect,
  type CanvasSnapshot,
  DRAWING_TOOL_DRAG_MIME,
  getCanvasPoint,
  getDrawingBrushSettings,
  isPlaceableDrawingTool,
  type ContainedRect,
  type DrawingElement,
  type DrawingPoint,
  type DrawingShapeElement,
  type DrawingShapeTool,
  type DrawingTool,
  type PlaceableDrawingTool,
} from './drawing-canvas-model';
import {
  createDrawingSaveDebouncer,
  syncDrawingSlide,
  type DrawingSaveDebouncer,
} from './drawing-persistence';
import { hasMinimumShapeSize, isShapeTool, type ShapeTool } from './shape-renderer';

type DrawingCanvasProps = {
  activeTool: DrawingTool;
  clearRequestId: number;
  eraserRadius: number;
  isDrawingMode: boolean;
  penColour: string;
  penWidth: number;
  redoRequestId?: number;
  redoStack?: CanvasSnapshot[];
  slideHeightPx: number;
  slideId: number;
  slideWidthPx: number;
  undoRequestId?: number;
  undoStack?: CanvasSnapshot[];
  onClearHistory?: () => void;
  onRecordSnapshot?: (snapshot: CanvasSnapshot) => void;
  onRedo?: (currentSnapshot: CanvasSnapshot) => void;
  onUndo?: (currentSnapshot: CanvasSnapshot) => void;
};

type ShapeDragState = {
  snapshot: CanvasSnapshot;
  startPoint: DrawingPoint;
  tool: ShapeTool;
};

type DroppedShapePoints = {
  endPoint: DrawingPoint;
  startPoint: DrawingPoint;
};

type DrawingSnapshotData = {
  canvasData: string;
  elements: DrawingElement[];
  version: 1;
};

type ElementDragState = {
  elementId: string;
  moved: boolean;
  origin: DrawingPoint;
  pointerStart: DrawingPoint;
  snapshot: CanvasSnapshot | null;
};

export function getDrawingCanvasPointerEvents(isDrawingMode: boolean): 'auto' | 'none' {
  return isDrawingMode ? 'auto' : 'none';
}

export function getDrawingCanvasCursor(isDrawingMode: boolean, activeTool: DrawingTool): string {
  if (!isDrawingMode) {
    return 'default';
  }

  if (activeTool === 'eraser') {
    return 'none';
  }

  return 'crosshair';
}

export function getDroppedShapePoints(options: {
  canvasHeight: number;
  canvasWidth: number;
  point: DrawingPoint;
  tool: PlaceableDrawingTool;
}): DroppedShapePoints {
  const shapeWidth = options.tool === 'line' || options.tool === 'arrow' ? 170 : 180;
  const shapeHeight = options.tool === 'line' || options.tool === 'arrow' ? 95 : 110;
  const width = Math.min(shapeWidth, Math.max(1, options.canvasWidth));
  const height = Math.min(shapeHeight, Math.max(1, options.canvasHeight));
  const left = clamp(options.point.x - width / 2, 0, Math.max(0, options.canvasWidth - width));
  const top = clamp(options.point.y - height / 2, 0, Math.max(0, options.canvasHeight - height));

  return {
    endPoint: {
      x: left + width,
      y: top + height,
    },
    startPoint: {
      x: left,
      y: top,
    },
  };
}

export function DrawingCanvas({
  activeTool,
  clearRequestId,
  eraserRadius,
  isDrawingMode,
  penColour,
  penWidth,
  redoRequestId = 0,
  redoStack = [],
  slideHeightPx,
  slideId,
  slideWidthPx,
  undoRequestId = 0,
  undoStack = [],
  onClearHistory,
  onRecordSnapshot,
  onRedo,
  onUndo,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSlideIdRef = useRef<number | null>(null);
  const currentOperationSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const dirtyRef = useRef(false);
  const elementDragRef = useRef<ElementDragState | null>(null);
  const elementsRef = useRef<DrawingElement[]>([]);
  const handledClearRequestIdRef = useRef(0);
  const handledRedoRequestIdRef = useRef(0);
  const handledUndoRequestIdRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const loadTokenRef = useRef(0);
  const operationDirtyRef = useRef(false);
  const saveDebouncerRef = useRef<DrawingSaveDebouncer | null>(null);
  const shapeDragRef = useRef<ShapeDragState | null>(null);
  const wasDrawingModeRef = useRef(isDrawingMode);
  const [canvasBounds, setCanvasBounds] = useState<ContainedRect | null>(null);
  const [drawingElements, setDrawingElementsState] = useState<DrawingElement[]>([]);
  const [eraserPoint, setEraserPoint] = useState<DrawingPoint | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [shapePreview, setShapePreview] = useState<DrawingShapeElement | null>(null);

  if (!saveDebouncerRef.current) {
    saveDebouncerRef.current = createDrawingSaveDebouncer(async (payload) => {
      const response = await window.garlicSauce?.saveDrawing(
        payload.slideId,
        payload.canvasData,
        payload.elementsJson,
      );

      if (response?.saved && activeSlideIdRef.current === payload.slideId) {
        dirtyRef.current = false;
      }
    }, 500);
  }

  const captureCanvasData = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return null;
    }

    return canvas.toDataURL('image/png');
  }, []);

  const setDrawingElements = useCallback((nextElements: DrawingElement[]) => {
    elementsRef.current = nextElements;
    setDrawingElementsState(nextElements);
  }, []);

  const captureElementsJson = useCallback(
    () => drawingElementsToStoredElements(elementsRef.current),
    [],
  );

  const captureDrawingSnapshot = useCallback((): CanvasSnapshot | null => {
    const canvasData = captureCanvasData();

    if (!canvasData) {
      return null;
    }

    return JSON.stringify({
      canvasData,
      elements: elementsRef.current,
      version: 1,
    } satisfies DrawingSnapshotData);
  }, [captureCanvasData]);

  const clearCanvasPixels = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.save();
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }, []);

  const restoreCanvasData = useCallback(async (canvasData: string) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    await drawImageOnCanvas(canvas, canvasData);
  }, []);

  const clearDrawingElements = useCallback(() => {
    elementsRef.current = [];
    setDrawingElementsState([]);
    setSelectedElementId(null);
    setShapePreview(null);
  }, []);

  const restoreDrawingSnapshot = useCallback(
    async (snapshot: CanvasSnapshot) => {
      const parsedSnapshot = parseDrawingSnapshot(snapshot);

      if (parsedSnapshot) {
        await restoreCanvasData(parsedSnapshot.canvasData);
        setDrawingElements(parsedSnapshot.elements);
        setSelectedElementId(null);
        setShapePreview(null);
        return;
      }

      await restoreCanvasData(snapshot);
      clearDrawingElements();
    },
    [clearDrawingElements, restoreCanvasData, setDrawingElements],
  );

  const flushCurrentDrawing = useCallback(async () => {
    const slideToSave = activeSlideIdRef.current;

    await saveDebouncerRef.current?.flush();

    if (!slideToSave || !dirtyRef.current) {
      return;
    }

    const canvasData = captureCanvasData();

    if (!canvasData) {
      return;
    }

    const response = await window.garlicSauce?.saveDrawing(
      slideToSave,
      canvasData,
      captureElementsJson(),
    );

    if (response?.saved && activeSlideIdRef.current === slideToSave) {
      dirtyRef.current = false;
    }
  }, [captureCanvasData, captureElementsJson]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return undefined;
    }

    const updateBounds = () => {
      const rect = container.getBoundingClientRect();

      setCanvasBounds(
        calculateContainedRect({
          containerHeight: rect.height,
          containerWidth: rect.width,
          contentHeight: slideHeightPx,
          contentWidth: slideWidthPx,
        }),
      );
    };

    updateBounds();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateBounds);

      return () => {
        window.removeEventListener('resize', updateBounds);
      };
    }

    const observer = new ResizeObserver(updateBounds);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [slideHeightPx, slideWidthPx]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !canvasBounds) {
      return;
    }

    void resizeCanvasToBounds(canvas, canvasBounds);
  }, [canvasBounds]);

  useEffect(() => {
    let cancelled = false;
    const previousSlideId = activeSlideIdRef.current;
    const shouldSavePreviousSlide = dirtyRef.current;
    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    if (previousSlideId === null) {
      activeSlideIdRef.current = slideId;
    }
    onClearHistory?.();
    currentOperationSnapshotRef.current = null;
    operationDirtyRef.current = false;
    shapeDragRef.current = null;
    setEraserPoint(null);
    setSelectedElementId(null);
    setShapePreview(null);

    void (async () => {
      await saveDebouncerRef.current?.flush();

      if (cancelled) {
        return;
      }

      const previousSlideStillDirty = shouldSavePreviousSlide && dirtyRef.current;
      activeSlideIdRef.current = slideId;
      dirtyRef.current = false;

      await syncDrawingSlide({
        captureCanvasData,
        captureElementsJson,
        clearCanvas: clearCanvasPixels,
        clearElements: clearDrawingElements,
        isDirty: previousSlideStillDirty,
        loadDrawing: async (nextSlideId) => {
          const response = await window.garlicSauce?.getDrawing(nextSlideId);

          if (!response?.found) {
            return null;
          }

          return response.drawing ?? null;
        },
        nextSlideId: slideId,
        previousSlideId,
        restoreDrawing: async (drawing) => {
          if (!cancelled && loadTokenRef.current === token) {
            await restoreCanvasData(drawing.canvasData);
            setDrawingElements(storedElementsToDrawingElements(drawing.elementsJson));
          }
        },
        saveDrawing: async (previous, canvasData, elementsJson) => {
          await window.garlicSauce?.saveDrawing(previous, canvasData, elementsJson);
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    captureCanvasData,
    captureElementsJson,
    clearCanvasPixels,
    clearDrawingElements,
    onClearHistory,
    restoreCanvasData,
    setDrawingElements,
    slideId,
  ]);

  useEffect(() => {
    if (clearRequestId <= 0 || handledClearRequestIdRef.current === clearRequestId) {
      return;
    }

    handledClearRequestIdRef.current = clearRequestId;
    saveDebouncerRef.current?.cancel();
    const snapshot = captureDrawingSnapshot();

    if (snapshot) {
      onRecordSnapshot?.(snapshot);
    }

    clearCanvasPixels();
    dirtyRef.current = false;
    currentOperationSnapshotRef.current = null;
    operationDirtyRef.current = false;
    shapeDragRef.current = null;
    clearDrawingElements();
    void window.garlicSauce?.clearDrawing(slideId);
    setEraserPoint(null);
  }, [
    captureDrawingSnapshot,
    clearCanvasPixels,
    clearDrawingElements,
    clearRequestId,
    onRecordSnapshot,
    slideId,
  ]);

  useEffect(() => {
    if (wasDrawingModeRef.current && !isDrawingMode) {
      void flushCurrentDrawing();
      setEraserPoint(null);
      setSelectedElementId(null);
    }

    wasDrawingModeRef.current = isDrawingMode;
  }, [flushCurrentDrawing, isDrawingMode]);

  useEffect(() => {
    const flushBeforeUnload = () => {
      void flushCurrentDrawing();
    };

    window.addEventListener('beforeunload', flushBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', flushBeforeUnload);
      flushBeforeUnload();
    };
  }, [flushCurrentDrawing]);

  const scheduleCurrentSave = useCallback(() => {
    const currentSlideId = activeSlideIdRef.current;
    const canvasData = captureCanvasData();

    if (!currentSlideId || !canvasData) {
      return;
    }

    saveDebouncerRef.current?.schedule({
      canvasData,
      elementsJson: captureElementsJson(),
      slideId: currentSlideId,
    });
  }, [captureCanvasData, captureElementsJson]);

  useEffect(() => {
    if (undoRequestId <= 0 || handledUndoRequestIdRef.current === undoRequestId) {
      return;
    }

    handledUndoRequestIdRef.current = undoRequestId;
    const snapshotToRestore = undoStack.at(-1);
    const currentSnapshot = captureDrawingSnapshot();

    if (!snapshotToRestore || !currentSnapshot) {
      return;
    }

    saveDebouncerRef.current?.cancel();
    onUndo?.(currentSnapshot);
    setEraserPoint(null);
    setSelectedElementId(null);
    void restoreDrawingSnapshot(snapshotToRestore).then(() => {
      dirtyRef.current = true;
      scheduleCurrentSave();
    });
  }, [
    captureDrawingSnapshot,
    onUndo,
    restoreDrawingSnapshot,
    scheduleCurrentSave,
    undoRequestId,
    undoStack,
  ]);

  useEffect(() => {
    if (redoRequestId <= 0 || handledRedoRequestIdRef.current === redoRequestId) {
      return;
    }

    handledRedoRequestIdRef.current = redoRequestId;
    const snapshotToRestore = redoStack.at(-1);
    const currentSnapshot = captureDrawingSnapshot();

    if (!snapshotToRestore || !currentSnapshot) {
      return;
    }

    saveDebouncerRef.current?.cancel();
    onRedo?.(currentSnapshot);
    setEraserPoint(null);
    setSelectedElementId(null);
    void restoreDrawingSnapshot(snapshotToRestore).then(() => {
      dirtyRef.current = true;
      scheduleCurrentSave();
    });
  }, [
    captureDrawingSnapshot,
    onRedo,
    redoRequestId,
    redoStack,
    restoreDrawingSnapshot,
    scheduleCurrentSave,
  ]);

  const prepareContext = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return null;
    }

    applyBrushSettings(
      context,
      getDrawingBrushSettings({
        eraserRadius,
        penColour,
        penWidth,
        tool: activeTool,
      }),
    );

    return {
      canvas,
      context,
    };
  }, [activeTool, eraserRadius, penColour, penWidth]);

  const addElement = useCallback(
    (element: DrawingElement, snapshot: CanvasSnapshot | null) => {
      setDrawingElements([...elementsRef.current, element]);
      setSelectedElementId(element.id);

      if (snapshot) {
        onRecordSnapshot?.(snapshot);
      }

      dirtyRef.current = true;
      scheduleCurrentSave();
    },
    [onRecordSnapshot, scheduleCurrentSave, setDrawingElements],
  );

  const updateElement = useCallback(
    (elementId: string, update: (element: DrawingElement) => DrawingElement) => {
      const nextElements = elementsRef.current.map((element) =>
        element.id === elementId ? update(element) : element,
      );
      setDrawingElements(nextElements);
    },
    [setDrawingElements],
  );

  const addShapeElement = useCallback(
    (tool: DrawingShapeTool, startPoint: DrawingPoint, endPoint: DrawingPoint) => {
      if (!hasMinimumShapeSize(startPoint, endPoint)) {
        return;
      }

      const snapshot = captureDrawingSnapshot();

      if (!snapshot) {
        return;
      }

      addElement(
        createShapeElement({
          colour: penColour,
          endPoint,
          lineWidth: penWidth,
          startPoint,
          tool,
        }),
        snapshot,
      );
    },
    [addElement, captureDrawingSnapshot, penColour, penWidth],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) {
      return;
    }

    const drawingContext = prepareContext();

    if (!drawingContext) {
      return;
    }

    saveDebouncerRef.current?.cancel();
    const point = getCanvasPoint(event.nativeEvent, drawingContext.canvas.getBoundingClientRect());

    drawingContext.canvas.setPointerCapture?.(event.pointerId);
    isPointerDownRef.current = true;
    operationDirtyRef.current = false;
    currentOperationSnapshotRef.current = captureDrawingSnapshot();
    setEraserPoint(activeTool === 'eraser' ? point : null);
    setSelectedElementId(null);

    if (isShapeTool(activeTool)) {
      shapeDragRef.current = currentOperationSnapshotRef.current
        ? {
            snapshot: currentOperationSnapshotRef.current,
            startPoint: point,
            tool: activeTool,
          }
        : null;
      return;
    }

    drawingContext.context.beginPath();
    drawingContext.context.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) {
      return;
    }

    const drawingContext = prepareContext();

    if (!drawingContext) {
      return;
    }

    const point = getCanvasPoint(event.nativeEvent, drawingContext.canvas.getBoundingClientRect());

    if (activeTool === 'eraser') {
      setEraserPoint(point);
    }

    if (!isPointerDownRef.current) {
      return;
    }

    const shapeDrag = shapeDragRef.current;

    if (shapeDrag) {
      setShapePreview(
        createShapeElement({
          colour: penColour,
          endPoint: point,
          id: 'preview',
          lineWidth: penWidth,
          startPoint: shapeDrag.startPoint,
          tool: shapeDrag.tool,
        }),
      );
      operationDirtyRef.current = true;
      return;
    }

    drawingContext.context.lineTo(point.x, point.y);
    drawingContext.context.stroke();
    operationDirtyRef.current = true;
    dirtyRef.current = true;
  };

  const finishPointerStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) {
      return;
    }

    isPointerDownRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const drawingContext = prepareContext();
    const point = drawingContext
      ? getCanvasPoint(event.nativeEvent, drawingContext.canvas.getBoundingClientRect())
      : null;
    const shapeDrag = shapeDragRef.current;

    if (point && shapeDrag) {
      if (hasMinimumShapeSize(shapeDrag.startPoint, point)) {
        addElement(
          createShapeElement({
            colour: penColour,
            endPoint: point,
            lineWidth: penWidth,
            startPoint: shapeDrag.startPoint,
            tool: shapeDrag.tool,
          }),
          shapeDrag.snapshot,
        );
      }

      shapeDragRef.current = null;
      setShapePreview(null);
      currentOperationSnapshotRef.current = null;
      operationDirtyRef.current = false;
      return;
    }

    if (operationDirtyRef.current && currentOperationSnapshotRef.current) {
      onRecordSnapshot?.(currentOperationSnapshotRef.current);
    }

    currentOperationSnapshotRef.current = null;
    operationDirtyRef.current = false;

    if (dirtyRef.current) {
      scheduleCurrentSave();
    }
  };

  const handlePointerLeave = () => {
    if (!isPointerDownRef.current) {
      setEraserPoint(null);
    }
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!isDrawingMode || !hasDrawingToolDragData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!isDrawingMode) {
      return;
    }

    const tool = event.dataTransfer.getData(DRAWING_TOOL_DRAG_MIME);

    if (!isPlaceableDrawingTool(tool)) {
      return;
    }

    event.preventDefault();
    saveDebouncerRef.current?.cancel();
    const drawingContext = prepareContext();

    if (!drawingContext) {
      return;
    }

    const point = getCanvasPoint(event.nativeEvent, drawingContext.canvas.getBoundingClientRect());
    setEraserPoint(null);
    setSelectedElementId(null);

    const shapePoints = getDroppedShapePoints({
      canvasHeight: drawingContext.canvas.height,
      canvasWidth: drawingContext.canvas.width,
      point,
      tool,
    });
    addShapeElement(tool, shapePoints.startPoint, shapePoints.endPoint);
  };

  const handleElementPointerDown = (
    event: ReactPointerEvent<HTMLElement | SVGSVGElement>,
    element: DrawingElement,
  ) => {
    if (!isDrawingMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    saveDebouncerRef.current?.cancel();
    setSelectedElementId(element.id);
    elementDragRef.current = {
      elementId: element.id,
      moved: false,
      origin: {
        x: element.x,
        y: element.y,
      },
      pointerStart: {
        x: event.clientX,
        y: event.clientY,
      },
      snapshot: captureDrawingSnapshot(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleElementPointerMove = (
    event: ReactPointerEvent<HTMLElement | SVGSVGElement>,
    elementId: string,
  ) => {
    const dragState = elementDragRef.current;

    if (!dragState || dragState.elementId !== elementId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - dragState.pointerStart.x;
    const deltaY = event.clientY - dragState.pointerStart.y;

    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      dragState.moved = true;
    }

    const canvas = canvasRef.current;
    updateElement(elementId, (element) => ({
      ...element,
      x: clamp(
        dragState.origin.x + deltaX,
        0,
        Math.max(0, (canvas?.width ?? Number.POSITIVE_INFINITY) - element.width),
      ),
      y: clamp(
        dragState.origin.y + deltaY,
        0,
        Math.max(0, (canvas?.height ?? Number.POSITIVE_INFINITY) - element.height),
      ),
    }));
  };

  const handleElementPointerUp = (
    event: ReactPointerEvent<HTMLElement | SVGSVGElement>,
    elementId: string,
  ) => {
    const dragState = elementDragRef.current;

    if (!dragState || dragState.elementId !== elementId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    elementDragRef.current = null;

    if (dragState.moved && dragState.snapshot) {
      onRecordSnapshot?.(dragState.snapshot);
      dirtyRef.current = true;
      scheduleCurrentSave();
    }
  };

  const canvasCursor = getDrawingCanvasCursor(isDrawingMode, activeTool);
  const pointerEvents = getDrawingCanvasPointerEvents(isDrawingMode);
  const canvasStyle: CSSProperties = canvasBounds
    ? {
        cursor: canvasCursor,
        height: canvasBounds.height,
        left: canvasBounds.left,
        pointerEvents,
        top: canvasBounds.top,
        width: canvasBounds.width,
      }
    : {
        cursor: canvasCursor,
        inset: 0,
        pointerEvents,
      };
  const eraserCursorStyle: CSSProperties | undefined =
    isDrawingMode && activeTool === 'eraser' && eraserPoint && canvasBounds
      ? {
          height: eraserRadius * 2,
          left: canvasBounds.left + eraserPoint.x - eraserRadius,
          top: canvasBounds.top + eraserPoint.y - eraserRadius,
          width: eraserRadius * 2,
        }
      : undefined;

  return (
    <>
      <canvas
        aria-hidden="true"
        className="drawing-canvas"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerCancel={finishPointerStroke}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerStroke}
        ref={canvasRef}
        style={canvasStyle}
      />
      <div
        aria-hidden={!isDrawingMode}
        className="drawing-object-layer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          ...canvasStyle,
          pointerEvents: 'none',
        }}
      >
        {drawingElements.map((element) =>
          renderDrawingElement({
            element,
            isSelected: selectedElementId === element.id,
            onPointerDown: handleElementPointerDown,
            onPointerMove: handleElementPointerMove,
            onPointerUp: handleElementPointerUp,
          }),
        )}
        {shapePreview
          ? renderDrawingShapeElement({
              element: shapePreview,
              isPreview: true,
              isSelected: false,
              onPointerDown: handleElementPointerDown,
              onPointerMove: handleElementPointerMove,
              onPointerUp: handleElementPointerUp,
            })
          : null}
      </div>
      {eraserCursorStyle ? (
        <span className="drawing-canvas__eraser-cursor" style={eraserCursorStyle} />
      ) : null}
    </>
  );
}

type RenderElementOptions = {
  element: DrawingElement;
  isSelected: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLElement | SVGSVGElement>,
    element: DrawingElement,
  ) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement | SVGSVGElement>, elementId: string) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement | SVGSVGElement>, elementId: string) => void;
};

function renderDrawingElement(options: RenderElementOptions) {
  return renderDrawingShapeElement({
    element: options.element,
    isPreview: false,
    isSelected: options.isSelected,
    onPointerDown: options.onPointerDown,
    onPointerMove: options.onPointerMove,
    onPointerUp: options.onPointerUp,
  });
}

function renderDrawingShapeElement(options: {
  element: DrawingShapeElement;
  isPreview: boolean;
  isSelected: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLElement | SVGSVGElement>,
    element: DrawingElement,
  ) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement | SVGSVGElement>, elementId: string) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement | SVGSVGElement>, elementId: string) => void;
}) {
  const { element } = options;
  const className = [
    'drawing-object',
    'drawing-object--shape',
    options.isSelected ? 'drawing-object--selected' : '',
    options.isPreview ? 'drawing-object--preview' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={className}
      data-drawing-object-id={element.id}
      key={element.id}
      onPointerDown={(event) => options.onPointerDown(event, element)}
      onPointerMove={(event) => options.onPointerMove(event, element.id)}
      onPointerUp={(event) => options.onPointerUp(event, element.id)}
      style={{
        height: element.height,
        left: element.x,
        pointerEvents: options.isPreview ? 'none' : undefined,
        top: element.y,
        width: element.width,
      }}
      viewBox={`0 0 ${Math.max(1, element.width)} ${Math.max(1, element.height)}`}
    >
      {renderShapeElementPath(element)}
    </svg>
  );
}

function renderShapeElementPath(element: DrawingShapeElement) {
  const strokeProps = {
    fill: 'none',
    stroke: element.colour,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: element.lineWidth,
  };

  switch (element.tool) {
    case 'arrow':
      return (
        <>
          <defs>
            <marker
              id={`arrowhead-${element.id}`}
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
            >
              <path d="M0 0L8 4L0 8z" fill={element.colour} />
            </marker>
          </defs>
          <line
            {...strokeProps}
            markerEnd={`url(#arrowhead-${element.id})`}
            x1="0"
            x2={element.width}
            y1="0"
            y2={element.height}
          />
        </>
      );
    case 'ellipse':
      return (
        <ellipse
          {...strokeProps}
          cx={element.width / 2}
          cy={element.height / 2}
          rx={Math.max(0, element.width / 2 - element.lineWidth / 2)}
          ry={Math.max(0, element.height / 2 - element.lineWidth / 2)}
        />
      );
    case 'line':
      return <line {...strokeProps} x1="0" x2={element.width} y1="0" y2={element.height} />;
    case 'rectangle':
      return (
        <rect
          {...strokeProps}
          height={Math.max(0, element.height - element.lineWidth)}
          width={Math.max(0, element.width - element.lineWidth)}
          x={element.lineWidth / 2}
          y={element.lineWidth / 2}
        />
      );
  }
}

async function resizeCanvasToBounds(
  canvas: HTMLCanvasElement,
  bounds: ContainedRect,
): Promise<void> {
  const nextWidth = Math.max(1, Math.round(bounds.width));
  const nextHeight = Math.max(1, Math.round(bounds.height));

  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }

  const previousData =
    canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL('image/png') : undefined;

  canvas.width = nextWidth;
  canvas.height = nextHeight;

  if (previousData) {
    await drawImageOnCanvas(canvas, previousData);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasDrawingToolDragData(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(DRAWING_TOOL_DRAG_MIME);
}

function createShapeElement(options: {
  colour: string;
  endPoint: DrawingPoint;
  id?: string;
  lineWidth: number;
  startPoint: DrawingPoint;
  tool: DrawingShapeTool;
}): DrawingShapeElement {
  const left = Math.min(options.startPoint.x, options.endPoint.x);
  const top = Math.min(options.startPoint.y, options.endPoint.y);

  return {
    colour: options.colour,
    height: Math.abs(options.endPoint.y - options.startPoint.y),
    id: options.id ?? createDrawingElementId(),
    lineWidth: options.lineWidth,
    tool: options.tool,
    type: 'shape',
    width: Math.abs(options.endPoint.x - options.startPoint.x),
    x: left,
    y: top,
  };
}

function createDrawingElementId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function drawingElementsToStoredElements(elements: DrawingElement[]): GarlicSauceDrawingElement[] {
  return elements.map((element) => ({ ...element }));
}

function storedElementsToDrawingElements(elements: GarlicSauceDrawingElement[]): DrawingElement[] {
  return elements.filter(isDrawingElement);
}

function parseDrawingSnapshot(snapshot: CanvasSnapshot): DrawingSnapshotData | null {
  try {
    const parsed = JSON.parse(snapshot) as Partial<DrawingSnapshotData>;

    if (
      parsed.version === 1 &&
      typeof parsed.canvasData === 'string' &&
      Array.isArray(parsed.elements)
    ) {
      return {
        canvasData: parsed.canvasData,
        elements: parsed.elements.filter(isDrawingElement),
        version: 1,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isDrawingElement(element: unknown): element is DrawingElement {
  if (!element || typeof element !== 'object') {
    return false;
  }

  const candidate = element as Partial<DrawingElement>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.x !== 'number' ||
    typeof candidate.y !== 'number' ||
    typeof candidate.width !== 'number' ||
    typeof candidate.height !== 'number' ||
    typeof candidate.colour !== 'string'
  ) {
    return false;
  }

  return (
    candidate.type === 'shape' &&
    typeof candidate.lineWidth === 'number' &&
    (candidate.tool === 'rectangle' ||
      candidate.tool === 'ellipse' ||
      candidate.tool === 'arrow' ||
      candidate.tool === 'line')
  );
}

function drawImageOnCanvas(canvas: HTMLCanvasElement, canvasData: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener('load', () => {
      const context = canvas.getContext('2d');

      if (context) {
        context.save();
        context.globalCompositeOperation = 'source-over';
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.restore();
      }

      resolve();
    });
    image.addEventListener('error', () => resolve());
    image.src = canvasData;
  });
}
