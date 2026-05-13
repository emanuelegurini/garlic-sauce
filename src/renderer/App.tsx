import { useEffect, useMemo, useState } from 'react';

type ImportStatus = 'error' | 'idle' | 'importing' | 'selecting' | 'success';

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
  const activeFileName = useMemo(() => fileNameFromPath(activeFilePath), [activeFilePath]);

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

  const importPresentation = async () => {
    if (!api || status === 'selecting' || status === 'importing') {
      return;
    }

    setStatus('selecting');
    setError(undefined);
    setResult(undefined);
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

  const cancelImport = async () => {
    if (!api || !activeImportId) {
      return;
    }

    await api.cancelImport(activeImportId);
  };

  const isBusy = status === 'selecting' || status === 'importing';

  return (
    <main className="workspace">
      <header className="titlebar">
        <div>
          <p className="app-kicker">Garlic Sauce</p>
          <h1>Presentation Import</h1>
        </div>
        <button className="primary-action" disabled={!api || isBusy} onClick={importPresentation}>
          {status === 'selecting' ? 'Choosing file' : 'Import deck'}
        </button>
      </header>

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
