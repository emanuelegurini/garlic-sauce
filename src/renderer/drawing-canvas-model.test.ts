import { describe, expect, it } from 'vitest';
import {
  buildStrokePath,
  calculateContainedRect,
  type DrawingHistoryState,
  addUndoSnapshot,
  applyRedoSnapshot,
  applyUndoSnapshot,
  getCanvasPoint,
  getDrawingBrushSettings,
  isPlaceableDrawingTool,
} from './drawing-canvas-model';

describe('drawing canvas model', () => {
  it('builds freehand stroke commands from pointer points', () => {
    expect(
      buildStrokePath([
        { x: 10, y: 12 },
        { x: 14, y: 18 },
        { x: 21, y: 19 },
      ]),
    ).toEqual([
      { type: 'beginPath' },
      { point: { x: 10, y: 12 }, type: 'moveTo' },
      { point: { x: 14, y: 18 }, type: 'lineTo' },
      { point: { x: 21, y: 19 }, type: 'lineTo' },
      { type: 'stroke' },
    ]);
  });

  it('uses the default pen and eraser canvas composite settings', () => {
    expect(
      getDrawingBrushSettings({
        eraserRadius: 20,
        penColour: '#FF0000',
        penWidth: 3,
        tool: 'pen',
      }),
    ).toEqual({
      globalCompositeOperation: 'source-over',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 3,
      strokeStyle: '#FF0000',
    });

    expect(
      getDrawingBrushSettings({
        eraserRadius: 20,
        penColour: '#FF0000',
        penWidth: 3,
        tool: 'eraser',
      }),
    ).toEqual({
      globalCompositeOperation: 'destination-out',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 40,
      strokeStyle: '#000000',
    });

    expect(
      getDrawingBrushSettings({
        eraserRadius: 20,
        penColour: '#00AA88',
        penWidth: 5,
        tool: 'arrow',
      }),
    ).toEqual({
      globalCompositeOperation: 'source-over',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 5,
      strokeStyle: '#00AA88',
    });
  });

  it('calculates the contained slide rect inside the viewer', () => {
    expect(
      calculateContainedRect({
        containerHeight: 600,
        containerWidth: 1000,
        contentHeight: 900,
        contentWidth: 1600,
      }),
    ).toEqual({
      height: 562.5,
      left: 0,
      top: 18.75,
      width: 1000,
    });
  });

  it('maps pointer coordinates into clamped canvas coordinates', () => {
    expect(
      getCanvasPoint(
        {
          clientX: 260,
          clientY: 90,
        },
        {
          height: 150,
          left: 100,
          top: 50,
          width: 200,
        },
      ),
    ).toEqual({
      x: 160,
      y: 40,
    });

    expect(
      getCanvasPoint(
        {
          clientX: 20,
          clientY: 500,
        },
        {
          height: 150,
          left: 100,
          top: 50,
          width: 200,
        },
      ),
    ).toEqual({
      x: 0,
      y: 150,
    });
  });

  it('identifies drawing tools that can be dragged onto the canvas', () => {
    expect(isPlaceableDrawingTool('rectangle')).toBe(true);
    expect(isPlaceableDrawingTool('ellipse')).toBe(true);
    expect(isPlaceableDrawingTool('arrow')).toBe(true);
    expect(isPlaceableDrawingTool('line')).toBe(true);
    expect(isPlaceableDrawingTool('text')).toBe(false);
    expect(isPlaceableDrawingTool('pen')).toBe(false);
    expect(isPlaceableDrawingTool('eraser')).toBe(false);
  });

  it('moves canvas snapshots through undo and redo history', () => {
    const initialHistory: DrawingHistoryState = {
      redoStack: [],
      undoStack: [],
    };
    const recordedHistory = addUndoSnapshot(
      addUndoSnapshot(initialHistory, 'before-a'),
      'before-b',
    );
    const undoneHistory = applyUndoSnapshot(recordedHistory, 'current-b');
    const redoneHistory = applyRedoSnapshot(undoneHistory, 'current-a');

    expect(recordedHistory.undoStack).toEqual(['before-a', 'before-b']);
    expect(recordedHistory.redoStack).toEqual([]);
    expect(undoneHistory.undoStack).toEqual(['before-a']);
    expect(undoneHistory.redoStack).toEqual(['current-b']);
    expect(redoneHistory.undoStack).toEqual(['before-a', 'current-a']);
    expect(redoneHistory.redoStack).toEqual([]);
  });
});
