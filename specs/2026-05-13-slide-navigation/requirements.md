# Phase 4 — Slide Navigation: Requirements

## Goal

Enable trainers to navigate between slides during a presentation, hide
individual slides so they are skipped, and toggle a minimap sidebar that
provides an overview of all slides with their visibility state.

## Scope

This phase covers:

- On-screen Previous / Next navigation buttons.
- Left / Right arrow keyboard shortcuts for slide navigation.
- A slide counter showing the current position (e.g. "3 / 12").
- A toggleable minimap panel displaying thumbnail previews of all slides.
- The ability to hide/reveal any slide from the minimap.
- Hidden slides are skipped when navigating with next/prev.
- Hidden slides remain visible in the minimap but are visually dimmed.

## Out of Scope

- Presenter notes (Phase 5).
- Detached windows (Phase 6).
- Drawing tools (Phase 7+).
- Drag-and-drop slide reordering.
- Filmstrip as the only navigation method (next/prev buttons always present).

## Decisions

| Decision                | Choice                                 | Rationale                                                 |
| ----------------------- | -------------------------------------- | --------------------------------------------------------- |
| Keyboard shortcuts      | Left/Right arrow only                  | Keep it simple; avoid conflicts with future drawing tools |
| Hide-slide storage      | `hidden` column on `slides` table      | Co-located with slide data; no extra join needed          |
| Minimap toggle          | Button in the header area              | Keeps the main slide view uncluttered by default          |
| Hidden-slide appearance | Dimmed thumbnail + strikethrough label | Trainer can still see and control hidden slides           |
| Navigation skips hidden | Yes                                    | Hidden slides are invisible to the audience flow          |

## Context

- The `slides` table already has `presentation_id` and `slide_order`.
- `SlideViewer` accepts a `slideOrder` prop — navigation changes this value.
- The preload bridge exposes `getSlideImage`; we may need a new IPC call to
  fetch all slide thumbnails for the minimap.
- The app currently shows only one slide at a time with no way to advance.

## User Stories

1. As a trainer, I want to click Previous/Next buttons so I can move between
   slides without memorising keyboard shortcuts.
2. As a trainer, I want to press ← / → to quickly flip slides during a live
   session.
3. As a trainer, I want to see which slide I'm on (e.g. "3 / 12") so I know
   my position in the deck.
4. As a trainer, I want to toggle a minimap so I can get an overview of the
   full deck when I need it, and dismiss it to maximise the slide view.
5. As a trainer, I want to hide a slide from the minimap so it is skipped
   during presentation, without deleting it.
6. As a trainer, I want hidden slides to appear dimmed in the minimap so I
   can easily tell which ones are active and re-enable them if needed.
