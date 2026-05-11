export function App() {
  const versions = window.garlicSauce?.versions;

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <div className="hero__content">
          <p className="hero__eyebrow">Trainer presentation workspace</p>
          <h1 id="app-title">Garlic Sauce</h1>
          <p className="hero__summary">
            A desktop shell ready for PowerPoint import, private notes, slide-safe sharing,
            annotations, and whiteboard workflows.
          </p>
        </div>
        {versions ? (
          <dl className="runtime-panel" aria-label="Runtime versions">
            <div>
              <dt>Electron</dt>
              <dd>{versions.electron}</dd>
            </div>
            <div>
              <dt>Chrome</dt>
              <dd>{versions.chrome}</dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>{versions.node}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
