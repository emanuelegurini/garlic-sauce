import { useCallback, useEffect, useRef, useState } from 'react';
import { NotesEditor } from './NotesEditor';
import {
  createNotesSaveDebouncer,
  type NotesSaveDebouncer,
  type NotesSavePayload,
} from './notes-autosave';
import { createEditableNotesDocument, noteResponseToHtml } from './notes-content';

type NoteLoadStatus = 'error' | 'idle' | 'loading' | 'ready';
type NoteSaveStatus = 'error' | 'idle' | 'saved' | 'saving';
type ThumbnailStatus = 'error' | 'idle' | 'loading' | 'ready';

export function NotesWindow() {
  const api = window.garlicSauce;
  const [context, setContext] = useState<GarlicSauceNotesSlideContext | null>(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [loadStatus, setLoadStatus] = useState<NoteLoadStatus>('idle');
  const [loadError, setLoadError] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('idle');
  const [saveError, setSaveError] = useState<string>();
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [thumbnailStatus, setThumbnailStatus] = useState<ThumbnailStatus>('idle');
  const [thumbnail, setThumbnail] =
    useState<Extract<GarlicSauceSlideImageResponse, { found: true }>>();
  const saveDebouncerRef = useRef<NotesSaveDebouncer | null>(null);

  if (!saveDebouncerRef.current) {
    saveDebouncerRef.current = createNotesSaveDebouncer(async (payload: NotesSavePayload) => {
      const bridge = window.garlicSauce;

      if (!bridge) {
        setSaveStatus('error');
        setSaveError('Desktop bridge unavailable.');
        return;
      }

      setSaveStatus('saving');
      setSaveError(undefined);

      const response = await bridge.saveNotes(
        payload.slideId,
        payload.contentJson,
        payload.plainText,
      );

      if (response.saved) {
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('error');
      setSaveError(response.error);
    }, 500);
  }

  useEffect(() => {
    if (!api) {
      setLoadStatus('error');
      setLoadError('Desktop bridge unavailable.');
      return undefined;
    }

    let cancelled = false;

    void api.getCurrentNotesSlide().then((currentContext) => {
      if (!cancelled) {
        setContext(currentContext);
      }
    });

    const unsubscribe = api.onNotesSlideChanged((currentContext) => {
      setContext(currentContext);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [api]);

  useEffect(() => {
    const saveDebouncer = saveDebouncerRef.current;
    let cancelled = false;

    void (async () => {
      await saveDebouncer?.flush();

      if (cancelled) {
        return;
      }

      if (!api) {
        setLoadStatus('error');
        setLoadError('Desktop bridge unavailable.');
        return;
      }

      if (!context) {
        setEditorHtml('');
        setLoadStatus('idle');
        setLoadError(undefined);
        setSaveStatus('idle');
        setSaveError(undefined);
        return;
      }

      setLoadStatus('loading');
      setLoadError(undefined);
      setSaveStatus('idle');
      setSaveError(undefined);

      try {
        const response = await api.getNotes(context.slideId);

        if (cancelled) {
          return;
        }

        if (response.found) {
          setEditorHtml(noteResponseToHtml(response.note));
          setLoadStatus('ready');
          setSaveStatus(response.note.updatedAt ? 'saved' : 'idle');
          return;
        }

        setLoadStatus('error');
        setLoadError(response.error);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadStatus('error');
        setLoadError(error instanceof Error ? error.message : 'The note could not be loaded.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, context]);

  useEffect(() => {
    const flushPendingSave = () => {
      void saveDebouncerRef.current?.flush();
    };

    window.addEventListener('beforeunload', flushPendingSave);

    return () => {
      window.removeEventListener('beforeunload', flushPendingSave);
      flushPendingSave();
    };
  }, []);

  useEffect(() => {
    if (!api || !context || !showThumbnail) {
      setThumbnail(undefined);
      setThumbnailStatus('idle');
      return undefined;
    }

    let cancelled = false;

    setThumbnail(undefined);
    setThumbnailStatus('loading');

    void api
      .getSlideImage({
        presentationId: context.presentationId,
        slideOrder: context.slideOrder,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.found) {
          setThumbnail(response);
          setThumbnailStatus('ready');
        } else {
          setThumbnailStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThumbnailStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, context, showThumbnail]);

  const handleEditorChange = useCallback(
    (html: string, plainText: string) => {
      if (!context || loadStatus !== 'ready') {
        return;
      }

      setSaveStatus('saving');
      setSaveError(undefined);
      saveDebouncerRef.current?.schedule({
        contentJson: createEditableNotesDocument(html),
        plainText,
        slideId: context.slideId,
      });
    },
    [context, loadStatus],
  );

  const slideLabel = context ? `Slide ${context.slideOrder + 1}` : 'No slide selected';

  return (
    <main className="notes-window">
      <header className="notes-header">
        <div>
          <p className="app-kicker">Presenter notes</p>
          <h1>{slideLabel}</h1>
        </div>
        <button
          className="secondary-action"
          disabled={!context}
          onClick={() => setShowThumbnail((visible) => !visible)}
          type="button"
        >
          {showThumbnail ? 'Hide preview' : 'Show preview'}
        </button>
      </header>

      <section className="notes-workspace" aria-live="polite">
        {!api ? (
          <NotesMessage>Desktop bridge unavailable.</NotesMessage>
        ) : loadStatus === 'loading' ? (
          <NotesMessage>Loading notes</NotesMessage>
        ) : loadStatus === 'error' ? (
          <NotesMessage>{loadError ?? 'The note could not be loaded.'}</NotesMessage>
        ) : context ? (
          <NotesEditor html={editorHtml} onChange={handleEditorChange} />
        ) : (
          <NotesMessage>No slide selected.</NotesMessage>
        )}
      </section>

      <footer className="notes-footer">
        <span>{saveStatusLabel(saveStatus, saveError)}</span>
        {context ? <span>{context.title}</span> : null}
      </footer>

      {showThumbnail && context ? (
        <section className="notes-thumbnail" aria-label="Current slide preview">
          {thumbnailStatus === 'ready' && thumbnail ? (
            <img
              alt={`${context.title} slide ${context.slideOrder + 1}`}
              height={thumbnail.heightPx}
              src={thumbnail.dataUrl}
              width={thumbnail.widthPx}
            />
          ) : thumbnailStatus === 'error' ? (
            <p>Preview unavailable.</p>
          ) : (
            <p>Loading preview</p>
          )}
        </section>
      ) : null}
    </main>
  );
}

function NotesMessage({ children }: { children: string }) {
  return (
    <div className="notes-message">
      <p>{children}</p>
    </div>
  );
}

function saveStatusLabel(status: NoteSaveStatus, error: string | undefined): string {
  switch (status) {
    case 'error':
      return error ?? 'Save failed';
    case 'saved':
      return 'Saved';
    case 'saving':
      return 'Saving';
    default:
      return 'Ready';
  }
}
