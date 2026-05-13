import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DrawingToolbar } from './DrawingToolbar';

describe('DrawingToolbar', () => {
  it('does not render when drawing mode is off', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingToolbar, {
        activeTool: 'pen',
        isDrawingMode: false,
        onClear: vi.fn(),
        onClose: vi.fn(),
        onSelectTool: vi.fn(),
      }),
    );

    expect(markup).toBe('');
  });

  it('renders tool buttons and highlights the active tool', () => {
    const markup = renderToStaticMarkup(
      createElement(DrawingToolbar, {
        activeTool: 'eraser',
        isDrawingMode: true,
        onClear: vi.fn(),
        onClose: vi.fn(),
        onSelectTool: vi.fn(),
      }),
    );

    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Pen"');
    expect(markup).toContain('aria-label="Eraser"');
    expect(markup).toContain('aria-label="Clear drawing"');
    expect(markup).toContain('aria-label="Close drawing tools"');
    expect(markup).toContain('drawing-toolbar__button--active');
    expect(markup).toContain('aria-pressed="true"');
  });
});
