import { useEffect, useState } from 'react';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingToolbar } from './DrawingToolbar';
import type { DrawingTool } from './drawing-canvas-model';
import type { DrawingTools } from './useDrawingTools';

type SlideViewerState =
  | {
      status: 'loading';
    }
  | {
      message: string;
      presentationId: number;
      slideOrder: number;
      status: 'error';
    }
  | {
      image: Extract<GarlicSauceSlideImageResponse, { found: true }>;
      presentationId: number;
      slideOrder: number;
      status: 'ready';
    };

type SlideViewerProps = {
  clearDrawingRequestId?: number;
  drawingTools?: DrawingTools;
  onClearDrawing?: () => void;
  onCloseDrawingMode?: () => void;
  onRedoDrawing?: () => void;
  onSelectDrawingTool?: (tool: DrawingTool) => void;
  onUndoDrawing?: () => void;
  presentationId: number;
  redoDrawingRequestId?: number;
  slideId?: number;
  slideOrder?: number;
  title: string;
  undoDrawingRequestId?: number;
};

export function getCurrentSlideViewerState(
  state: SlideViewerState,
  presentationId: number,
  slideOrder: number,
): SlideViewerState {
  if (state.status === 'loading') {
    return state;
  }

  if (state.presentationId === presentationId && state.slideOrder === slideOrder) {
    return state;
  }

  return {
    status: 'loading',
  };
}

export function SlideViewer({
  clearDrawingRequestId = 0,
  drawingTools,
  onClearDrawing,
  onCloseDrawingMode,
  onRedoDrawing,
  onSelectDrawingTool,
  onUndoDrawing,
  presentationId,
  redoDrawingRequestId = 0,
  slideId,
  slideOrder = 0,
  title,
  undoDrawingRequestId = 0,
}: SlideViewerProps) {
  const [state, setState] = useState<SlideViewerState>({ status: 'loading' });
  const currentState = getCurrentSlideViewerState(state, presentationId, slideOrder);

  useEffect(() => {
    let cancelled = false;

    setState({ status: 'loading' });

    void window.garlicSauce
      ?.getSlideImage({
        presentationId,
        slideOrder,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.found) {
          setState({
            image: response,
            presentationId,
            slideOrder,
            status: 'ready',
          });
        } else {
          setState({
            message: response.error,
            presentationId,
            slideOrder,
            status: 'error',
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          message: error instanceof Error ? error.message : 'The slide image could not be loaded.',
          presentationId,
          slideOrder,
          status: 'error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [presentationId, slideOrder]);

  if (!window.garlicSauce) {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <p>Desktop bridge unavailable.</p>
      </section>
    );
  }

  if (currentState.status === 'loading') {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Loading slide</p>
      </section>
    );
  }

  if (currentState.status === 'error') {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <p>{currentState.message}</p>
      </section>
    );
  }

  return (
    <section className="slide-viewer" aria-label="Current slide">
      <img
        className="slide-viewer__image"
        src={currentState.image.dataUrl}
        width={currentState.image.widthPx}
        height={currentState.image.heightPx}
        alt={`${title} slide ${slideOrder + 1}`}
      />
      {drawingTools && slideId ? (
        <DrawingCanvas
          activeTool={drawingTools.activeTool}
          clearRequestId={clearDrawingRequestId}
          eraserRadius={drawingTools.eraserRadius}
          isDrawingMode={drawingTools.isDrawingMode}
          onClearHistory={drawingTools.clearHistory}
          onRecordSnapshot={drawingTools.recordSnapshot}
          onRedo={drawingTools.redo}
          onUndo={drawingTools.undo}
          penColour={drawingTools.penColour}
          penWidth={drawingTools.penWidth}
          redoRequestId={redoDrawingRequestId}
          redoStack={drawingTools.redoStack}
          slideHeightPx={currentState.image.heightPx}
          slideId={slideId}
          slideWidthPx={currentState.image.widthPx}
          undoRequestId={undoDrawingRequestId}
          undoStack={drawingTools.undoStack}
        />
      ) : null}
      {drawingTools &&
      onClearDrawing &&
      onCloseDrawingMode &&
      onRedoDrawing &&
      onSelectDrawingTool &&
      onUndoDrawing ? (
        <DrawingToolbar
          activeTool={drawingTools.activeTool}
          canRedo={drawingTools.redoStack.length > 0}
          canUndo={drawingTools.undoStack.length > 0}
          isDrawingMode={drawingTools.isDrawingMode}
          onClear={onClearDrawing}
          onClose={onCloseDrawingMode}
          onRedo={onRedoDrawing}
          onSelectTool={onSelectDrawingTool}
          onUndo={onUndoDrawing}
        />
      ) : null}
      {currentState.image.renderError ? (
        <p className="slide-viewer__notice">{currentState.image.renderError}</p>
      ) : null}
    </section>
  );
}
