import Database from 'better-sqlite3';

export type AppDatabase = Database.Database;

export function openDatabase(databasePath: string): AppDatabase {
  const database = new Database(databasePath);
  initializeDatabase(database);

  return database;
}

export function initializeDatabase(database: AppDatabase): void {
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      source_format TEXT NOT NULL CHECK (source_format IN ('pptx', 'ppt')),
      title TEXT NOT NULL,
      slide_width_emu INTEGER NOT NULL,
      slide_height_emu INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presentation_themes (
      presentation_id INTEGER PRIMARY KEY,
      theme_json TEXT NOT NULL,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id INTEGER NOT NULL,
      slide_order INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      layout_name TEXT,
      width_emu INTEGER NOT NULL,
      height_emu INTEGER NOT NULL,
      background_json TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      UNIQUE (presentation_id, slide_order)
    );

    CREATE TABLE IF NOT EXISTS slide_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL UNIQUE,
      presentation_id INTEGER NOT NULL,
      content_json TEXT NOT NULL DEFAULT '{}',
      plain_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS slide_drawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL UNIQUE,
      presentation_id INTEGER NOT NULL,
      canvas_data BLOB NOT NULL,
      elements_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shapes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL,
      shape_order INTEGER NOT NULL,
      kind TEXT NOT NULL,
      name TEXT,
      preset TEXT,
      x_emu INTEGER,
      y_emu INTEGER,
      width_emu INTEGER,
      height_emu INTEGER,
      rotation REAL,
      fill_json TEXT,
      stroke_json TEXT,
      media_relationship_id TEXT,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
      UNIQUE (slide_id, shape_order)
    );

    CREATE TABLE IF NOT EXISTS text_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shape_id INTEGER NOT NULL,
      run_order INTEGER NOT NULL,
      content TEXT NOT NULL,
      font_family TEXT,
      font_size_pt REAL,
      bold INTEGER NOT NULL DEFAULT 0,
      italic INTEGER NOT NULL DEFAULT 0,
      colour TEXT,
      alignment TEXT,
      FOREIGN KEY (shape_id) REFERENCES shapes(id) ON DELETE CASCADE,
      UNIQUE (shape_id, run_order)
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id INTEGER NOT NULL,
      slide_id INTEGER,
      relationship_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      extension TEXT NOT NULL,
      data BLOB NOT NULL,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS slide_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL UNIQUE,
      presentation_id INTEGER NOT NULL,
      slide_order INTEGER NOT NULL,
      width_px INTEGER NOT NULL,
      height_px INTEGER NOT NULL,
      image_format TEXT NOT NULL DEFAULT 'png',
      data BLOB NOT NULL,
      render_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      UNIQUE (presentation_id, slide_order)
    );

    CREATE TABLE IF NOT EXISTS required_fonts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id INTEGER NOT NULL,
      font_family TEXT NOT NULL,
      is_missing INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      UNIQUE (presentation_id, font_family)
    );

    CREATE INDEX IF NOT EXISTS idx_slides_presentation_order
      ON slides (presentation_id, slide_order);

    CREATE INDEX IF NOT EXISTS idx_slide_notes_presentation_slide
      ON slide_notes (presentation_id, slide_id);

    CREATE INDEX IF NOT EXISTS idx_slide_drawings_presentation_slide
      ON slide_drawings (presentation_id, slide_id);

    CREATE INDEX IF NOT EXISTS idx_shapes_slide_order
      ON shapes (slide_id, shape_order);

    CREATE INDEX IF NOT EXISTS idx_text_runs_shape_order
      ON text_runs (shape_id, run_order);

    CREATE INDEX IF NOT EXISTS idx_media_presentation
      ON media (presentation_id);

    CREATE INDEX IF NOT EXISTS idx_slide_images_presentation_order
      ON slide_images (presentation_id, slide_order);
  `);

  migrateSlidesHiddenColumn(database);
  migrateSlideDrawingsElementsColumn(database);
}

export function writeMetadata(database: AppDatabase, key: string, value: string): void {
  database
    .prepare(
      `
        INSERT INTO app_metadata (key, value, updated_at)
        VALUES (@key, @value, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .run({ key, value });
}

export function readMetadata(database: AppDatabase, key: string): string | undefined {
  const row = database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key) as
    | { value: string }
    | undefined;

  return row?.value;
}

function migrateSlidesHiddenColumn(database: AppDatabase): void {
  const columns = database.prepare('PRAGMA table_info(slides)').all() as Array<{ name: string }>;
  const hasHiddenColumn = columns.some((column) => column.name === 'hidden');

  if (!hasHiddenColumn) {
    database.exec('ALTER TABLE slides ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
  }
}

function migrateSlideDrawingsElementsColumn(database: AppDatabase): void {
  const columns = database.prepare('PRAGMA table_info(slide_drawings)').all() as Array<{
    name: string;
  }>;
  const hasElementsColumn = columns.some((column) => column.name === 'elements_json');

  if (!hasElementsColumn) {
    database.exec("ALTER TABLE slide_drawings ADD COLUMN elements_json TEXT NOT NULL DEFAULT '[]'");
  }
}
