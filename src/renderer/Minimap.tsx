type MinimapProps = {
  currentSlideOrder: number | null;
  onGoTo: (slideOrder: number) => void;
  onToggleHidden: (slideOrder: number) => void;
  pendingSlideOrder?: number;
  slides: GarlicSauceSlideListItem[];
};

export function Minimap({
  currentSlideOrder,
  onGoTo,
  onToggleHidden,
  pendingSlideOrder,
  slides,
}: MinimapProps) {
  return (
    <aside className="minimap" aria-label="Slide minimap">
      <div className="minimap__header">
        <h2>Slides</h2>
        <span>{slides.length}</span>
      </div>
      <ol className="minimap__list">
        {slides.map((slide) => {
          const isActive = slide.slideOrder === currentSlideOrder;
          const label = `Slide ${slide.slideOrder + 1}`;

          return (
            <li
              className={`minimap__item${isActive ? ' minimap__item--active' : ''}${
                slide.hidden ? ' minimap__item--hidden' : ''
              }`}
              key={slide.slideOrder}
            >
              <button
                aria-current={isActive ? 'true' : undefined}
                className="minimap__thumb-button"
                disabled={slide.hidden}
                onClick={() => onGoTo(slide.slideOrder)}
                type="button"
              >
                <img
                  alt={`${label} thumbnail`}
                  className="minimap__thumb"
                  src={slide.thumbnailDataUrl}
                />
                <span className="minimap__label">{label}</span>
                {slide.hidden ? <span className="minimap__badge">Hidden</span> : null}
              </button>
              <button
                aria-label={`${slide.hidden ? 'Reveal' : 'Hide'} ${label}`}
                aria-pressed={slide.hidden}
                className="minimap__visibility-button"
                disabled={pendingSlideOrder === slide.slideOrder}
                onClick={() => onToggleHidden(slide.slideOrder)}
                type="button"
              >
                {slide.hidden ? 'Show' : 'Hide'}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
