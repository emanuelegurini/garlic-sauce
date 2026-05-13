import { useCallback, useReducer } from 'react';
import {
  addUndoSnapshot,
  applyRedoSnapshot,
  applyUndoSnapshot,
  type CanvasSnapshot,
  type DrawingTool,
} from './drawing-canvas-model';

export type DrawingToolsState = {
  activeTool: DrawingTool;
  eraserRadius: number;
  isDrawingMode: boolean;
  penColour: string;
  penWidth: number;
  redoStack: CanvasSnapshot[];
  undoStack: CanvasSnapshot[];
};

export type DrawingToolsAction =
  | {
      type: 'clearHistory' | 'closeDrawingMode' | 'openDrawingMode' | 'toggleDrawingMode';
    }
  | {
      currentSnapshot: CanvasSnapshot;
      type: 'redo' | 'undo';
    }
  | {
      snapshot: CanvasSnapshot;
      type: 'recordSnapshot';
    }
  | {
      tool: DrawingTool;
      type: 'setActiveTool';
    };

export type DrawingTools = DrawingToolsState & {
  clearHistory: () => void;
  closeDrawingMode: () => void;
  openDrawingMode: () => void;
  recordSnapshot: (snapshot: CanvasSnapshot) => void;
  redo: (currentSnapshot: CanvasSnapshot) => void;
  setActiveTool: (tool: DrawingTool) => void;
  toggleDrawingMode: () => void;
  undo: (currentSnapshot: CanvasSnapshot) => void;
};

export function createDefaultDrawingToolsState(): DrawingToolsState {
  return {
    activeTool: 'pen',
    eraserRadius: 20,
    isDrawingMode: false,
    penColour: '#FF0000',
    penWidth: 3,
    redoStack: [],
    undoStack: [],
  };
}

export function drawingToolsReducer(
  state: DrawingToolsState,
  action: DrawingToolsAction,
): DrawingToolsState {
  switch (action.type) {
    case 'closeDrawingMode':
      if (!state.isDrawingMode) {
        return state;
      }

      return {
        ...state,
        isDrawingMode: false,
      };
    case 'openDrawingMode':
      if (state.isDrawingMode) {
        return state;
      }

      return {
        ...state,
        isDrawingMode: true,
      };
    case 'setActiveTool':
      return {
        ...state,
        activeTool: action.tool,
      };
    case 'clearHistory':
      if (state.undoStack.length === 0 && state.redoStack.length === 0) {
        return state;
      }

      return {
        ...state,
        redoStack: [],
        undoStack: [],
      };
    case 'recordSnapshot':
      return {
        ...state,
        ...addUndoSnapshot(state, action.snapshot),
      };
    case 'redo':
      return {
        ...state,
        ...applyRedoSnapshot(state, action.currentSnapshot),
      };
    case 'toggleDrawingMode':
      return {
        ...state,
        isDrawingMode: !state.isDrawingMode,
      };
    case 'undo':
      return {
        ...state,
        ...applyUndoSnapshot(state, action.currentSnapshot),
      };
  }
}

export function useDrawingTools(): DrawingTools {
  const [state, dispatch] = useReducer(drawingToolsReducer, undefined, () =>
    createDefaultDrawingToolsState(),
  );

  const clearHistory = useCallback(() => {
    dispatch({ type: 'clearHistory' });
  }, []);

  const closeDrawingMode = useCallback(() => {
    dispatch({ type: 'closeDrawingMode' });
  }, []);

  const openDrawingMode = useCallback(() => {
    dispatch({ type: 'openDrawingMode' });
  }, []);

  const recordSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    dispatch({
      snapshot,
      type: 'recordSnapshot',
    });
  }, []);

  const redo = useCallback((currentSnapshot: CanvasSnapshot) => {
    dispatch({
      currentSnapshot,
      type: 'redo',
    });
  }, []);

  const setActiveTool = useCallback((tool: DrawingTool) => {
    dispatch({
      tool,
      type: 'setActiveTool',
    });
  }, []);

  const toggleDrawingMode = useCallback(() => {
    dispatch({ type: 'toggleDrawingMode' });
  }, []);

  const undo = useCallback((currentSnapshot: CanvasSnapshot) => {
    dispatch({
      currentSnapshot,
      type: 'undo',
    });
  }, []);

  return {
    ...state,
    clearHistory,
    closeDrawingMode,
    openDrawingMode,
    recordSnapshot,
    redo,
    setActiveTool,
    toggleDrawingMode,
    undo,
  };
}
