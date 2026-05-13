import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  applyBrushSettings,
  calculateContainedRect,
  getCanvasPoint,
  getDrawingBrushSettings,
  type ContainedRect,
  type DrawingPoint,
  type DrawingTool,
} from './drawing-canvas-model';
import {
  createDrawingSaveDebouncer,
  syncDrawingSlide,
  type DrawingSaveDebouncer,
} from './drawing-persistence';

type DrawingCanvasProps = {
  activeTool: DrawingTool;
  clearRequestId: number;
  eraserRadius: number;
  isDrawingMode: boolean;
  penColour: string;
  penWidth: number;
  slideHeightPx: number;
  slideId: number;
  slideWidthPx: number;
};

export function getDrawingCanvasPointerEvents(isDrawingMode: boolean): 'auto' | 'none' {
  return isDrawingMode ? 'auto' : 'none';
}

export function DrawingCanvas({
  activeTool,
  clearRequestId,
  eraserRadius,
  isDrawingMode,
  penColour,
  penWidth,
  slideHeightPx,
  slideId,
  slideWidthPx,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSlideIdRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const handledClearRequestIdRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const loadTokenRef = useRef(0);
  const saveDebouncerRef = useRef<DrawingSaveDebouncer | null>(null);
  const wasDrawingModeRef = useRef(isDrawingMode);
  const [canvasBounds, setCanvasBounds] = useState<ContainedRect | null>(null);
  const [eraserPoint, setEraserPoint] = useState<DrawingPoint | null>(null);

  if (!saveDebouncerRef.current) {
    saveDebouncerRef.current = createDrawingSaveDebouncer(async (payload) => {
      const response = await window.garlicSauce?.saveDrawing(payload.slideId, payload.canvasData);

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

    const response = await window.garlicSauce?.saveDrawing(slideToSave, canvasData);

    if (response?.saved && activeSlideIdRef.current === slideToSave) {
      dirtyRef.current = false;
    }
  }, [captureCanvasData]);

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
    setEraserPoint(null);

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
        clearCanvas: clearCanvasPixels,
        isDirty: previousSlideStillDirty,
        loadDrawing: async (nextSlideId) => {
          const response = await window.garlicSauce?.getDrawing(nextSlideId);

          if (!response?.found) {
            return null;
          }

          return response.drawing?.canvasData ?? null;
        },
        nextSlideId: slideId,
        previousSlideId,
        restoreDrawing: async (canvasData) => {
          if (!cancelled && loadTokenRef.current === token) {
            await restoreCanvasData(canvasData);
          }
        },
        saveDrawing: async (previous, canvasData) => {
          await window.garlicSauce?.saveDrawing(previous, canvasData);
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [captureCanvasData, clearCanvasPixels, restoreCanvasData, slideId]);

  useEffect(() => {
    if (clearRequestId <= 0 || handledClearRequestIdRef.current === clearRequestId) {
      return;
    }

    handledClearRequestIdRef.current = clearRequestId;
    saveDebouncerRef.current?.cancel();
    clearCanvasPixels();
    dirtyRef.current = false;
    void window.garlicSauce?.clearDrawing(slideId);
  }, [clearCanvasPixels, clearRequestId, slideId]);

  useEffect(() => {
    if (wasDrawingModeRef.current && !isDrawingMode) {
      void flushCurrentDrawing();
      setEraserPoint(null);
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
      slideId: currentSlideId,
    });
  }, [captureCanvasData]);

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
    drawingContext.context.beginPath();
    drawingContext.context.moveTo(point.x, point.y);
    isPointerDownRef.current = true;
    setEraserPoint(activeTool === 'eraser' ? point : null);
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

    drawingContext.context.lineTo(point.x, point.y);
    drawingContext.context.stroke();
    dirtyRef.current = true;
  };

  const finishPointerStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) {
      return;
    }

    isPointerDownRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (dirtyRef.current) {
      scheduleCurrentSave();
    }
  };

  const handlePointerLeave = () => {
    if (!isPointerDownRef.current) {
      setEraserPoint(null);
    }
  };

  const pointerEvents = getDrawingCanvasPointerEvents(isDrawingMode);
  const canvasStyle: CSSProperties = canvasBounds
    ? {
        cursor: isDrawingMode ? (activeTool === 'eraser' ? 'none' : 'crosshair') : 'default',
        height: canvasBounds.height,
        left: canvasBounds.left,
        pointerEvents,
        top: canvasBounds.top,
        width: canvasBounds.width,
      }
    : {
        cursor: isDrawingMode ? (activeTool === 'eraser' ? 'none' : 'crosshair') : 'default',
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
        onPointerCancel={finishPointerStroke}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerStroke}
        ref={canvasRef}
        style={canvasStyle}
      />
      {eraserCursorStyle ? (
        <span className="drawing-canvas__eraser-cursor" style={eraserCursorStyle} />
      ) : null}
    </>
  );
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
