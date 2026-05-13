import { useEffect, useState } from 'react';

type SlideViewerState =
  | {
      status: 'loading';
    }
  | {
      message: string;
      status: 'error';
    }
  | {
      image: Extract<GarlicSauceSlideImageResponse, { found: true }>;
      status: 'ready';
    };

type SlideViewerProps = {
  presentationId: number;
  slideOrder?: number;
  title: string;
};

export function SlideViewer({ presentationId, slideOrder = 0, title }: SlideViewerProps) {
  const [state, setState] = useState<SlideViewerState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    setState({ status: 'loading' });

    void window.garlicSauce
      ?.getSlideImage({
        presentationId,
        slideOrder,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.found) {
          setState({
            image: response,
            status: 'ready',
          });
        } else {
          setState({
            message: response.error,
            status: 'error',
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          message: error instanceof Error ? error.message : 'The slide image could not be loaded.',
          status: 'error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [presentationId, slideOrder]);

  if (!window.garlicSauce) {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <p>Desktop bridge unavailable.</p>
      </section>
    );
  }

  if (state.status === 'loading') {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Loading slide</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="slide-viewer slide-viewer--message" aria-live="polite">
        <p>{state.message}</p>
      </section>
    );
  }

  return (
    <section className="slide-viewer" aria-label="Current slide">
      <img
        className="slide-viewer__image"
        src={state.image.dataUrl}
        width={state.image.widthPx}
        height={state.image.heightPx}
        alt={`${title} slide ${slideOrder + 1}`}
      />
      {state.image.renderError ? (
        <p className="slide-viewer__notice">{state.image.renderError}</p>
      ) : null}
    </section>
  );
}
