import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeDatabase,
  openDatabase,
  readMetadata,
  type AppDatabase,
  writeMetadata,
} from './database';

type TableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: 0 | 1;
};

let database: AppDatabase | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('SQLite schema initialization', () => {
  it('creates the app metadata table with the expected columns', () => {
    database = openDatabase(':memory:');

    const columns = database.prepare('PRAGMA table_info(app_metadata)').all() as TableInfoRow[];

    expect(columns).toEqual([
      {
        cid: 0,
        name: 'key',
        type: 'TEXT',
        notnull: 0,
        dflt_value: null,
        pk: 1,
      },
      {
        cid: 1,
        name: 'value',
        type: 'TEXT',
        notnull: 1,
        dflt_value: null,
        pk: 0,
      },
      {
        cid: 2,
        name: 'updated_at',
        type: 'TEXT',
        notnull: 1,
        dflt_value: 'CURRENT_TIMESTAMP',
        pk: 0,
      },
    ]);
  });

  it('can initialize an existing database without losing metadata', () => {
    database = openDatabase(':memory:');

    writeMetadata(database, 'active-deck', 'intro');
    initializeDatabase(database);

    expect(readMetadata(database, 'active-deck')).toBe('intro');
  });

  it('creates slides with a hidden flag defaulting to visible', () => {
    database = openDatabase(':memory:');

    const columns = database.prepare('PRAGMA table_info(slides)').all() as TableInfoRow[];
    const hiddenColumn = columns.find((column) => column.name === 'hidden');

    expect(hiddenColumn).toMatchObject({
      dflt_value: '0',
      name: 'hidden',
      notnull: 1,
      type: 'INTEGER',
    });
  });

  it('migrates existing slide tables to include the hidden flag', () => {
    database = openDatabase(':memory:');
    database.exec(`
      DROP TABLE slides;

      CREATE TABLE slides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        presentation_id INTEGER NOT NULL,
        slide_order INTEGER NOT NULL,
        source_id TEXT NOT NULL,
        layout_name TEXT,
        width_emu INTEGER NOT NULL,
        height_emu INTEGER NOT NULL,
        background_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
        UNIQUE (presentation_id, slide_order)
      );

      INSERT INTO presentations (
        source_path,
        source_format,
        title,
        slide_width_emu,
        slide_height_emu
      )
      VALUES ('/tmp/migrated.pptx', 'pptx', 'Migrated', 914400, 914400);

      INSERT INTO slides (
        presentation_id,
        slide_order,
        source_id,
        width_emu,
        height_emu
      )
      VALUES (1, 0, 'slide1.xml', 914400, 914400);
    `);

    initializeDatabase(database);

    const row = database.prepare('SELECT hidden FROM slides WHERE id = 1').get();

    expect(row).toEqual({ hidden: 0 });
  });

  it('returns undefined when metadata has not been stored', () => {
    database = openDatabase(':memory:');

    expect(readMetadata(database, 'missing-key')).toBeUndefined();
  });
});
