import { useCallback, useReducer } from 'react';
import type { DrawingTool } from './drawing-canvas-model';

export type DrawingToolsState = {
  activeTool: DrawingTool;
  eraserRadius: number;
  isDrawingMode: boolean;
  penColour: string;
  penWidth: number;
};

export type DrawingToolsAction =
  | {
      type: 'closeDrawingMode' | 'openDrawingMode' | 'toggleDrawingMode';
    }
  | {
      tool: DrawingTool;
      type: 'setActiveTool';
    };

export type DrawingTools = DrawingToolsState & {
  closeDrawingMode: () => void;
  openDrawingMode: () => void;
  setActiveTool: (tool: DrawingTool) => void;
  toggleDrawingMode: () => void;
};

export function createDefaultDrawingToolsState(): DrawingToolsState {
  return {
    activeTool: 'pen',
    eraserRadius: 20,
    isDrawingMode: false,
    penColour: '#FF0000',
    penWidth: 3,
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
    case 'toggleDrawingMode':
      return {
        ...state,
        isDrawingMode: !state.isDrawingMode,
      };
  }
}

export function useDrawingTools(): DrawingTools {
  const [state, dispatch] = useReducer(drawingToolsReducer, undefined, () =>
    createDefaultDrawingToolsState(),
  );

  const closeDrawingMode = useCallback(() => {
    dispatch({ type: 'closeDrawingMode' });
  }, []);

  const openDrawingMode = useCallback(() => {
    dispatch({ type: 'openDrawingMode' });
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

  return {
    ...state,
    closeDrawingMode,
    openDrawingMode,
    setActiveTool,
    toggleDrawingMode,
  };
}
