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

  it('returns undefined when metadata has not been stored', () => {
    database = openDatabase(':memory:');

    expect(readMetadata(database, 'missing-key')).toBeUndefined();
  });
});
