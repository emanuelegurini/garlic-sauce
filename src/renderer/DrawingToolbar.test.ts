import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DrawingToolbar } from './DrawingToolbar';

describe('DrawingToolbar', () => {
  it('does not render when drawing mode is off', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingToolbar, {
        activeTool: 'pen',
        canRedo: false,
        canUndo: false,
        isDrawingMode: false,
        onClear: vi.fn(),
        onClose: vi.fn(),
        onRedo: vi.fn(),
        onSelectTool: vi.fn(),
        onUndo: vi.fn(),
      }),
    );

    expect(markup).toBe('');
  });

  it('renders tool buttons and highlights the active tool', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingToolbar, {
        activeTool: 'rectangle',
        canRedo: true,
        canUndo: true,
        isDrawingMode: true,
        onClear: vi.fn(),
        onClose: vi.fn(),
        onRedo: vi.fn(),
        onSelectTool: vi.fn(),
        onUndo: vi.fn(),
      }),
    );

    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Pen tool"');
    expect(markup).toContain('aria-label="Eraser tool"');
    expect(markup).toContain('aria-label="Rectangle tool"');
    expect(markup).toContain('aria-label="Ellipse tool"');
    expect(markup).toContain('aria-label="Arrow tool"');
    expect(markup).toContain('aria-label="Line tool"');
    expect(markup).not.toContain('aria-label="Text tool"');
    expect(markup).toContain('aria-label="Undo drawing"');
    expect(markup).toContain('aria-label="Redo drawing"');
    expect(markup).toContain('aria-label="Clear drawing"');
    expect(markup).toContain('aria-label="Close drawing tools"');
    expect(markup).toContain('title="Rectangle - drag onto slide or click to select"');
    expect(markup).toContain('draggable="true"');
    expect(markup).toContain('<svg');
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('drawing-toolbar__button--active');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('disables undo and redo buttons when history is empty', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingToolbar, {
        activeTool: 'pen',
        canRedo: false,
        canUndo: false,
        isDrawingMode: true,
        onClear: vi.fn(),
        onClose: vi.fn(),
        onRedo: vi.fn(),
        onSelectTool: vi.fn(),
        onUndo: vi.fn(),
      }),
    );

    expect(markup).toContain('aria-label="Undo drawing"');
    expect(markup).toContain('aria-label="Redo drawing"');
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });
});
