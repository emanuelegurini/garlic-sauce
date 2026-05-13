import { describe, expect, it } from 'vitest';
import { MAX_DRAWING_HISTORY_ENTRIES, type DrawingTool } from './drawing-canvas-model';
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
      redoStack: [],
      undoStack: [],
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

  it('supports every drawing palette tool', () => {
    const tools: DrawingTool[] = ['pen', 'eraser', 'rectangle', 'ellipse', 'arrow', 'line'];

    for (const tool of tools) {
      const state = drawingToolsReducer(createDefaultDrawingToolsState(), {
        tool,
        type: 'setActiveTool',
      });

      expect(state.activeTool).toBe(tool);
    }
  });

  it('records snapshots, clears redo on new edits, and applies undo/redo stack moves', () => {
    const stateWithSnapshots = ['before one', 'before two'].reduce<DrawingToolsState>(
      (state, snapshot) =>
        drawingToolsReducer(state, {
          snapshot,
          type: 'recordSnapshot',
        }),
      createDefaultDrawingToolsState(),
    );
    const undoneState = drawingToolsReducer(stateWithSnapshots, {
      currentSnapshot: 'current after two',
      type: 'undo',
    });
    const redoneState = drawingToolsReducer(undoneState, {
      currentSnapshot: 'current after undo',
      type: 'redo',
    });
    const editedAfterUndoState = drawingToolsReducer(undoneState, {
      snapshot: 'fresh branch',
      type: 'recordSnapshot',
    });

    expect(stateWithSnapshots.undoStack).toEqual(['before one', 'before two']);
    expect(undoneState.undoStack).toEqual(['before one']);
    expect(undoneState.redoStack).toEqual(['current after two']);
    expect(redoneState.undoStack).toEqual(['before one', 'current after undo']);
    expect(redoneState.redoStack).toEqual([]);
    expect(editedAfterUndoState.undoStack).toEqual(['before one', 'fresh branch']);
    expect(editedAfterUndoState.redoStack).toEqual([]);
  });

  it('caps undo history and clears all history on slide changes', () => {
    const saturatedState = Array.from(
      { length: MAX_DRAWING_HISTORY_ENTRIES + 1 },
      (_, index) => `snapshot ${index}`,
    ).reduce<DrawingToolsState>(
      (state, snapshot) =>
        drawingToolsReducer(state, {
          snapshot,
          type: 'recordSnapshot',
        }),
      createDefaultDrawingToolsState(),
    );
    const clearedState = drawingToolsReducer(
      {
        ...saturatedState,
        redoStack: ['redo snapshot'],
      },
      {
        type: 'clearHistory',
      },
    );

    expect(saturatedState.undoStack).toHaveLength(MAX_DRAWING_HISTORY_ENTRIES);
    expect(saturatedState.undoStack[0]).toBe('snapshot 1');
    expect(saturatedState.undoStack.at(-1)).toBe('snapshot 50');
    expect(clearedState.undoStack).toEqual([]);
    expect(clearedState.redoStack).toEqual([]);
  });
});
