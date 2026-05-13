import { useCallback, useEffect, useRef, useState } from 'react';

type NotesEditorProps = {
  disabled?: boolean;
  html: string;
  onChange: (html: string, plainText: string) => void;
};

const toolbarCommands = [
  {
    command: 'bold',
    label: 'B',
    title: 'Bold',
  },
  {
    command: 'italic',
    label: 'I',
    title: 'Italic',
  },
  {
    command: 'underline',
    label: 'U',
    title: 'Underline',
  },
  {
    command: 'insertUnorderedList',
    label: '•',
    title: 'Bullet list',
  },
] as const;

export function NotesEditor({ disabled = false, html, onChange }: NotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    setIsEmpty(editor.innerText.trim().length === 0);
    onChange(editor.innerHTML, editor.innerText);
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || editor.innerHTML === html) {
      return;
    }

    editor.innerHTML = html;
    setIsEmpty(editor.innerText.trim().length === 0);
  }, [html]);

  const runCommand = (command: string) => {
    if (disabled) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  };

  return (
    <section className="notes-editor" aria-label="Presenter notes editor">
      <div className="notes-editor__toolbar" aria-label="Formatting toolbar">
        {toolbarCommands.map((item) => (
          <button
            aria-label={item.title}
            className="notes-editor__tool"
            disabled={disabled}
            key={item.command}
            onClick={() => runCommand(item.command)}
            title={item.title}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        aria-label="Presenter notes"
        className={`notes-editor__surface${isEmpty ? ' notes-editor__surface--empty' : ''}`}
        contentEditable={!disabled}
        data-placeholder="Write notes for this slide"
        onInput={emitChange}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </section>
  );
}
