import { useEffect, useMemo, useState } from 'react';
import { Minimap } from './Minimap';
import { SlideViewer } from './SlideViewer';
import { getNavigationKeyAction, useSlideNavigation } from './useSlideNavigation';

type ImportStatus = 'error' | 'idle' | 'importing' | 'selecting' | 'success';
type SlideListStatus = 'error' | 'idle' | 'loading' | 'ready';

const emptyProgress: GarlicSauceImportProgress = {
  percent: 0,
  stage: 'reading',
  message: '',
};

function fileNameFromPath(filePath: string | undefined): string {
  if (!filePath) {
    return '';
  }

  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

export function App() {
  const api = window.garlicSauce;
  const versions = api?.versions;
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [activeImportId, setActiveImportId] = useState<string>();
  const [activeFilePath, setActiveFilePath] = useState<string>();
  const [progress, setProgress] = useState<GarlicSauceImportProgress>(emptyProgress);
  const [result, setResult] = useState<GarlicSauceImportResult>();
  const [error, setError] = useState<string>();
  const [fontPromptOpen, setFontPromptOpen] = useState(false);
  const [fontDownloadNotice, setFontDownloadNotice] = useState<string>();
  const [slideList, setSlideList] = useState<GarlicSauceSlideListItem[]>([]);
  const [slideListStatus, setSlideListStatus] = useState<SlideListStatus>('idle');
  const [slideListError, setSlideListError] = useState<string>();
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [pendingSlideOrder, setPendingSlideOrder] = useState<number>();
  const activeFileName = useMemo(() => fileNameFromPath(activeFilePath), [activeFilePath]);
  const navigation = useSlideNavigation(slideList);
  const hiddenSlideCount = useMemo(
    () => slideList.filter((slide) => slide.hidden).length,
    [slideList],
  );
  const isBusy = status === 'selecting' || status === 'importing';
  const isViewing = status === 'success' && result !== undefined;
  const slideCounter =
    navigation.visibleSlideCount > 0
      ? `${navigation.currentVisiblePosition} / ${navigation.visibleSlideCount}`
      : '0 / 0';
  const currentSlide = useMemo(
    () => slideList.find((slide) => slide.slideOrder === navigation.currentSlideOrder),
    [navigation.currentSlideOrder, slideList],
  );
  const currentNotesContext = useMemo<GarlicSauceNotesSlideContext | null>(() => {
    if (!isViewing || !result || !currentSlide) {
      return null;
    }

    return {
      presentationId: result.presentationId,
      slideId: currentSlide.slideId,
      slideOrder: currentSlide.slideOrder,
      title: result.title,
    };
  }, [currentSlide, isViewing, result]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }

    return api.onImportEvent((event) => {
      if (event.status === 'progress') {
        setActiveImportId(event.importId);
        setProgress(event.progress);
        setStatus('importing');
        return;
      }

      if (event.status === 'success') {
        setResult(event.result);
        setProgress({
          percent: 100,
          stage: 'complete',
          message: 'Import complete',
          slideCount: event.result.slideCount,
        });
        setStatus('success');
        setActiveImportId(undefined);
        setFontDownloadNotice(undefined);
        setFontPromptOpen(event.result.missingFonts.length > 0);
        return;
      }

      setError(event.error);
      setStatus('error');
      setActiveImportId(undefined);
    });
  }, [api]);

  useEffect(() => {
    if (!api || !result) {
      setSlideList([]);
      setSlideListError(undefined);
      setSlideListStatus('idle');
      return undefined;
    }

    let cancelled = false;

    setSlideListStatus('loading');
    setSlideListError(undefined);

    void api
      .getSlideList(result.presentationId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.found) {
          setSlideList(response.slides);
          setSlideListStatus('ready');
        } else {
          setSlideList([]);
          setSlideListError(response.error);
          setSlideListStatus('error');
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setSlideList([]);
        setSlideListError(
          loadError instanceof Error ? loadError.message : 'The slide list could not be loaded.',
        );
        setSlideListStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [api, result]);

  useEffect(() => {
    if (!isViewing || slideListStatus !== 'ready') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getNavigationKeyAction(event);

      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === 'next') {
        navigation.goNext();
      } else {
        navigation.goPrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewing, navigation.goNext, navigation.goPrev, slideListStatus]);

  useEffect(() => {
    if (!api) {
      return;
    }

    void api.setCurrentNotesSlide(
      isViewing && slideListStatus === 'ready' ? currentNotesContext : null,
    );
  }, [api, currentNotesContext, isViewing, slideListStatus]);

  const importPresentation = async () => {
    if (!api || status === 'selecting' || status === 'importing') {
      return;
    }

    setStatus('selecting');
    setError(undefined);
    setResult(undefined);
    setActiveFilePath(undefined);
    setFontPromptOpen(false);
    setFontDownloadNotice(undefined);
    setMinimapOpen(false);
    setSlideList([]);
    setSlideListError(undefined);
    setSlideListStatus('idle');
    setProgress(emptyProgress);

    const startedImport = await api.importPresentation();

    if (startedImport.cancelled) {
      setStatus('idle');
      return;
    }

    setActiveImportId(startedImport.importId);
    setActiveFilePath(startedImport.filePath);
    setStatus('importing');
    setProgress({
      percent: 1,
      stage: 'reading',
      message: 'Opening selected file',
    });
  };

  const openNotesWindow = async () => {
    if (!api) {
      return;
    }

    await api.openNotesWindow(currentNotesContext);
  };

  const cancelImport = async () => {
    if (!api || !activeImportId) {
      return;
    }

    await api.cancelImport(activeImportId);
  };

  const toggleSlideHidden = async (slideOrder: number) => {
    if (!api || !result || pendingSlideOrder !== undefined) {
      return;
    }

    setPendingSlideOrder(slideOrder);
    setSlideListError(undefined);

    try {
      const response = await api.toggleSlideHidden(result.presentationId, slideOrder);

      if (response.found) {
        setSlideList((slides) =>
          slides.map((slide) =>
            slide.slideOrder === slideOrder ? { ...slide, hidden: response.hidden } : slide,
          ),
        );
        setSlideListStatus('ready');
      } else {
        setSlideListError(response.error);
        setSlideListStatus('error');
      }
    } catch (toggleError) {
      setSlideListError(
        toggleError instanceof Error
          ? toggleError.message
          : 'The slide visibility could not be changed.',
      );
      setSlideListStatus('error');
    } finally {
      setPendingSlideOrder(undefined);
    }
  };

  return (
    <main className="workspace">
      <header className="titlebar">
        <div>
          <p className="app-kicker">Garlic Sauce</p>
          <h1>{isViewing ? result.title : 'Presentation Import'}</h1>
        </div>
        <div className="titlebar__actions">
          {isViewing ? (
            <>
              <button
                className="secondary-action"
                disabled={!api || !currentNotesContext}
                onClick={openNotesWindow}
                type="button"
              >
                Notes
              </button>
              <button
                className="secondary-action"
                onClick={() => setMinimapOpen((open) => !open)}
                type="button"
              >
                {minimapOpen ? 'Hide minimap' : 'Show minimap'}
              </button>
            </>
          ) : null}
          <button className="primary-action" disabled={!api || isBusy} onClick={importPresentation}>
            {status === 'selecting'
              ? 'Choosing file'
              : isViewing
                ? 'Import another deck'
                : 'Import deck'}
          </button>
        </div>
      </header>

      {isViewing ? (
        <section className={`viewer-layout${minimapOpen ? ' viewer-layout--with-minimap' : ''}`}>
          <div className="presentation-stage">
            {slideListStatus === 'loading' || slideListStatus === 'idle' ? (
              <ViewerMessage>Loading slide list</ViewerMessage>
            ) : slideListStatus === 'error' ? (
              <ViewerMessage>
                {slideListError ?? 'The slide list could not be loaded.'}
              </ViewerMessage>
            ) : navigation.allSlidesHidden ? (
              <ViewerMessage>
                No visible slides. Reveal a slide from the minimap to resume.
              </ViewerMessage>
            ) : navigation.currentSlideOrder === null ? (
              <ViewerMessage>No slides were found in this deck.</ViewerMessage>
            ) : (
              <SlideViewer
                presentationId={result.presentationId}
                slideOrder={navigation.currentSlideOrder}
                title={result.title}
              />
            )}

            <nav className="navigation-bar" aria-label="Slide navigation">
              <button
                className="secondary-action"
                disabled={!navigation.canGoPrev || slideListStatus !== 'ready'}
                onClick={navigation.goPrev}
                type="button"
              >
                Previous
              </button>
              <span className="slide-counter" aria-live="polite">
                {slideCounter}
              </span>
              <button
                className="secondary-action"
                disabled={!navigation.canGoNext || slideListStatus !== 'ready'}
                onClick={navigation.goNext}
                type="button"
              >
                Next
              </button>
            </nav>
          </div>

          {minimapOpen ? (
            <Minimap
              currentSlideOrder={navigation.currentSlideOrder}
              onGoTo={navigation.goTo}
              onToggleHidden={toggleSlideHidden}
              pendingSlideOrder={pendingSlideOrder}
              slides={slideList}
            />
          ) : null}

          <aside className="summary-panel" aria-label="Import summary">
            <dl>
              <div>
                <dt>Slide</dt>
                <dd>{slideCounter}</dd>
              </div>
              <div>
                <dt>Hidden</dt>
                <dd>{hiddenSlideCount}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>{result.mediaCount}</dd>
              </div>
              <div>
                <dt>Fonts</dt>
                <dd>{result.requiredFonts.length}</dd>
              </div>
              <div>
                <dt>Missing</dt>
                <dd>{result.missingFonts.length}</dd>
              </div>
            </dl>
          </aside>
        </section>
      ) : (
        <section className="import-surface" aria-live="polite">
          <div className="import-surface__main">
            <div className="status-strip">
              <span className={`status-dot status-dot--${status}`} />
              <span>{statusLabel(status)}</span>
            </div>

            {activeFileName ? <p className="file-name">{activeFileName}</p> : null}

            <div className="progress-block">
              <progress value={progress.percent} max={100} />
              <div className="progress-block__meta">
                <span>{progress.message || 'No deck imported'}</span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
            </div>

            {status === 'importing' ? (
              <button className="secondary-action" onClick={cancelImport}>
                Cancel import
              </button>
            ) : null}

            {status === 'error' && error ? <p className="error-banner">{error}</p> : null}
          </div>

          <aside className="summary-panel" aria-label="Import summary">
            <dl>
              <div>
                <dt>Slides</dt>
                <dd>{result?.slideCount ?? progress.slideCount ?? 0}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>{result?.mediaCount ?? 0}</dd>
              </div>
              <div>
                <dt>Fonts</dt>
                <dd>{result?.requiredFonts.length ?? 0}</dd>
              </div>
              <div>
                <dt>Missing</dt>
                <dd>{result?.missingFonts.length ?? 0}</dd>
              </div>
            </dl>
          </aside>
        </section>
      )}

      <section className="runtime-footer" aria-label="Runtime versions">
        <span>{api ? `Running on ${api.platform}` : 'Desktop bridge unavailable'}</span>
        {versions ? (
          <span>
            Electron {versions.electron} · Chrome {versions.chrome} · Node {versions.node}
          </span>
        ) : null}
      </section>

      {fontPromptOpen && result ? (
        <div className="modal-backdrop">
          <section
            className="font-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="font-title"
          >
            <h2 id="font-title">Missing fonts</h2>
            <p>The imported deck references fonts that are not installed on this computer.</p>
            <ul>
              {result.missingFonts.map((font) => (
                <li key={font}>{font}</li>
              ))}
            </ul>
            {fontDownloadNotice ? <p className="modal-notice">{fontDownloadNotice}</p> : null}
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setFontPromptOpen(false)}>
                Skip
              </button>
              <button
                className="primary-action"
                onClick={() =>
                  setFontDownloadNotice(
                    'A trusted font download source is not configured for this build.',
                  )
                }
              >
                Download fonts
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ViewerMessage({ children }: { children: string }) {
  return (
    <section className="slide-viewer slide-viewer--message" aria-live="polite">
      <p>{children}</p>
    </section>
  );
}

function statusLabel(status: ImportStatus): string {
  switch (status) {
    case 'error':
      return 'Import failed';
    case 'importing':
      return 'Importing';
    case 'selecting':
      return 'Selecting file';
    case 'success':
      return 'Import complete';
    default:
      return 'Ready';
  }
}
