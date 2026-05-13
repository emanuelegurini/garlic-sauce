import type { DragEvent } from 'react';
import {
  DRAWING_TOOL_DRAG_MIME,
  isPlaceableDrawingTool,
  type DrawingTool,
} from './drawing-canvas-model';

type ToolbarIcon = DrawingTool | 'clear' | 'close' | 'redo' | 'undo';

type DrawingToolbarProps = {
  activeTool: DrawingTool;
  canRedo: boolean;
  canUndo: boolean;
  isDrawingMode: boolean;
  onClear: () => void;
  onClose: () => void;
  onRedo: () => void;
  onSelectTool: (tool: DrawingTool) => void;
  onUndo: () => void;
};

const toolButtons: Array<{
  label: string;
  tool: DrawingTool;
}> = [
  {
    label: 'Pen',
    tool: 'pen',
  },
  {
    label: 'Eraser',
    tool: 'eraser',
  },
  {
    label: 'Rectangle',
    tool: 'rectangle',
  },
  {
    label: 'Ellipse',
    tool: 'ellipse',
  },
  {
    label: 'Arrow',
    tool: 'arrow',
  },
  {
    label: 'Line',
    tool: 'line',
  },
];

const commandButtons: Array<{
  label: string;
  type: Extract<ToolbarIcon, 'clear' | 'close' | 'redo' | 'undo'>;
}> = [
  {
    label: 'Undo drawing',
    type: 'undo',
  },
  {
    label: 'Redo drawing',
    type: 'redo',
  },
  {
    label: 'Clear drawing',
    type: 'clear',
  },
  {
    label: 'Close drawing tools',
    type: 'close',
  },
];

export function DrawingToolbar({
  activeTool,
  canRedo,
  canUndo,
  isDrawingMode,
  onClear,
  onClose,
  onRedo,
  onSelectTool,
  onUndo,
}: DrawingToolbarProps) {
  if (!isDrawingMode) {
    return null;
  }

  return (
    <div className="drawing-toolbar" aria-label="Drawing toolbar" role="toolbar">
      {toolButtons.map((button) => (
        <button
          aria-label={`${button.label} tool`}
          aria-pressed={activeTool === button.tool}
          className={`drawing-toolbar__button${
            activeTool === button.tool ? ' drawing-toolbar__button--active' : ''
          }`}
          key={button.tool}
          draggable={isPlaceableDrawingTool(button.tool)}
          onDragStart={(event) => handleToolDragStart(event, button.tool)}
          onClick={() => onSelectTool(button.tool)}
          title={
            isPlaceableDrawingTool(button.tool)
              ? `${button.label} - drag onto slide or click to select`
              : button.label
          }
          type="button"
        >
          <DrawingToolbarIcon icon={button.tool} />
        </button>
      ))}
      {commandButtons.map((button) => (
        <button
          aria-label={button.label}
          disabled={(button.type === 'undo' && !canUndo) || (button.type === 'redo' && !canRedo)}
          className={`drawing-toolbar__button drawing-toolbar__button--${button.type}`}
          key={button.type}
          onClick={getCommandClickHandler(button.type, {
            onClear,
            onClose,
            onRedo,
            onUndo,
          })}
          title={button.label}
          type="button"
        >
          <DrawingToolbarIcon icon={button.type} />
        </button>
      ))}
    </div>
  );
}

function handleToolDragStart(event: DragEvent<HTMLButtonElement>, tool: DrawingTool): void {
  if (!isPlaceableDrawingTool(tool)) {
    event.preventDefault();
    return;
  }

  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(DRAWING_TOOL_DRAG_MIME, tool);
}

function DrawingToolbarIcon({ icon }: { icon: ToolbarIcon }) {
  return (
    <svg aria-hidden="true" className="drawing-toolbar__icon" fill="none" viewBox="0 0 24 24">
      {renderToolbarIconPath(icon)}
    </svg>
  );
}

function renderToolbarIconPath(icon: ToolbarIcon) {
  switch (icon) {
    case 'arrow':
      return (
        <>
          <path d="M5 19L19 5" />
          <path d="M9 5h10v10" />
        </>
      );
    case 'clear':
      return (
        <>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </>
      );
    case 'close':
      return (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      );
    case 'ellipse':
      return <path d="M4 12a8 5.5 0 1 0 16 0a8 5.5 0 1 0-16 0" />;
    case 'eraser':
      return (
        <>
          <path d="M4 15l7-7a3 3 0 0 1 4.2 0l3.8 3.8a3 3 0 0 1 0 4.2l-4 4H8z" />
          <path d="M10 20h10" />
          <path d="M9 10l6 6" />
        </>
      );
    case 'line':
      return <path d="M5 19L19 5" />;
    case 'pen':
      return (
        <>
          <path d="M4 20l4.5-1l10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
          <path d="M13.5 7.5l3 3" />
        </>
      );
    case 'rectangle':
      return <path d="M5 6h14v12H5z" />;
    case 'redo':
      return (
        <>
          <path d="M20 7v6h-6" />
          <path d="M20 13a7 7 0 1 0-2.1 5" />
        </>
      );
    case 'undo':
      return (
        <>
          <path d="M4 7v6h6" />
          <path d="M4 13a7 7 0 1 1 2.1 5" />
        </>
      );
  }
}

function getCommandClickHandler(
  type: 'clear' | 'close' | 'redo' | 'undo',
  handlers: {
    onClear: () => void;
    onClose: () => void;
    onRedo: () => void;
    onUndo: () => void;
  },
): () => void {
  switch (type) {
    case 'clear':
      return handlers.onClear;
    case 'close':
      return handlers.onClose;
    case 'redo':
      return handlers.onRedo;
    case 'undo':
      return handlers.onUndo;
  }
}
