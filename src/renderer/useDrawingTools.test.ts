import { describe, expect, it } from 'vitest';
import {
  createDefaultDrawingToolsState,
  drawingToolsReducer,
  type DrawingToolsState,
} from './useDrawingTools';

describe('drawing tools state', () => {
  it('uses the phase defaults', () => {
    expect(createDefaultDrawingToolsState()).toEqual({
      activeTool: 'pen',
      eraserRadius: 20,
      isDrawingMode: false,
      penColour: '#FF0000',
      penWidth: 3,
    });
  });

  it('toggles drawing mode and switches tools', () => {
    const initialState = createDefaultDrawingToolsState();
    const openState = drawingToolsReducer(initialState, {
      type: 'toggleDrawingMode',
    });
    const eraserState = drawingToolsReducer(openState, {
      tool: 'eraser',
      type: 'setActiveTool',
    });
    const closedState: DrawingToolsState = drawingToolsReducer(eraserState, {
      type: 'closeDrawingMode',
    });

    expect(openState.isDrawingMode).toBe(true);
    expect(eraserState.activeTool).toBe('eraser');
    expect(closedState).toMatchObject({
      activeTool: 'eraser',
      isDrawingMode: false,
    });
  });
});
