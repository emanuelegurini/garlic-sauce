# Phase 5+6 — Presenter Notes Window: Requirements

## Goal

Give trainers access to their slide notes in a separate, private Electron
window that is never shared with the audience. Notes are extracted from
imported PowerPoint files and are editable with basic formatting directly
inside the app.

## Scope

This phase combines the original Phase 5 (Presenter Notes Panel) and
Phase 6 (Detached Notes Window) into a single deliverable:

- Extract presenter notes from `.pptx` files during import.
- Store notes per-slide in the local SQLite database.
- Display notes in a **separate Electron BrowserWindow** (not in the main
  slide window) so the trainer can screen-share the slide window safely.
- Provide basic rich-text editing: **bold**, _italic_, **underline**, and
  bullet lists.
- Sync the notes window to the currently-displayed slide (follows
  navigation from the main window).
- Optionally show a small slide thumbnail at the bottom of the notes
  window (toggled by the trainer).
- The trainer opens the notes window manually (menu item or toolbar
  button); it does not auto-open.

## Out of Scope

- Rich-text features beyond bold/italic/underline/bullets (Phase 10).
- Font selection, colours, headings (Phase 10).
- Drawing tools (Phase 7+).
- Notes for `.ppt` (legacy binary) files — best-effort only; not a
  hard requirement.

## Decisions

| Decision                     | Choice                                     | Rationale                                                    |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Notes window type            | Separate `BrowserWindow`                   | Screen-share-safe; trainer's private view                    |
| Notes storage                | `slide_notes` table in SQLite              | Keeps notes decoupled from shape/text data; easy to query    |
| Formatting library           | TipTap (ProseMirror-based) or equivalent   | Lightweight, extensible, works well in Electron/React        |
| Initial formatting           | Bold, italic, underline, bullet list       | Covers 90% of trainer note-taking; more in Phase 10          |
| Slide thumbnail in notes     | Optional toggle, shown at bottom           | Provides context without stealing space from notes           |
| Window open trigger          | Manual (menu / toolbar button)             | Trainer controls when notes are visible; no surprise windows |
| Empty-slide behaviour        | Show empty editor (ready to type)          | Encourages note-taking; no dead-end state                    |
| Notes extraction from import | Parse `ppt/notesSlides/*.xml` from `.pptx` | PowerPoint stores notes as XML; straightforward to extract   |

## Context

- The `slides` table has `id`, `presentation_id`, `slide_order`.
- The PPTX import pipeline already unzips and parses XML — adding notes
  extraction is an incremental change.
- The main window uses React; the notes window will also be a React app
  loaded from a separate entry point (or the same bundle with a route).
- Navigation state (current slide) lives in the renderer process of the
  main window; the notes window will need IPC to stay in sync.

## User Stories

1. As a trainer, I want my PowerPoint speaker notes imported automatically
   so I don't have to re-type them.
2. As a trainer, I want to view my notes in a separate window so I can
   screen-share the slide window without exposing my notes.
3. As a trainer, I want to edit notes with basic formatting (bold, italic,
   underline, bullets) so my notes are easy to scan during a live session.
4. As a trainer, I want the notes window to follow slide navigation so I
   always see notes for the current slide.
5. As a trainer, I want to optionally see a small slide preview in the
   notes window so I know which slide I'm on without switching windows.
6. As a trainer, I want to open the notes window only when I need it so my
   screen isn't cluttered during setup.
