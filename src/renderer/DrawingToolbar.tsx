import type { DrawingTool } from './drawing-canvas-model';

type DrawingToolbarProps = {
  activeTool: DrawingTool;
  isDrawingMode: boolean;
  onClear: () => void;
  onClose: () => void;
  onSelectTool: (tool: DrawingTool) => void;
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
];

export function DrawingToolbar({
  activeTool,
  isDrawingMode,
  onClear,
  onClose,
  onSelectTool,
}: DrawingToolbarProps) {
  if (!isDrawingMode) {
    return null;
  }

  return (
    <div className="drawing-toolbar" aria-label="Drawing toolbar" role="toolbar">
      {toolButtons.map((button) => (
        <button
          aria-label={button.label}
          aria-pressed={activeTool === button.tool}
          className={`drawing-toolbar__button${
            activeTool === button.tool ? ' drawing-toolbar__button--active' : ''
          }`}
          key={button.tool}
          onClick={() => onSelectTool(button.tool)}
          title={button.label}
          type="button"
        >
          {button.label}
        </button>
      ))}
      <button
        aria-label="Clear drawing"
        className="drawing-toolbar__button"
        onClick={onClear}
        title="Clear drawing"
        type="button"
      >
        Clear
      </button>
      <button
        aria-label="Close drawing tools"
        className="drawing-toolbar__button"
        onClick={onClose}
        title="Close drawing tools"
        type="button"
      >
        Close
      </button>
    </div>
  );
}
