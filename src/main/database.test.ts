import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, readMetadata, type AppDatabase, writeMetadata } from './database';

let database: AppDatabase | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('SQLite database', () => {
  it('writes and reads metadata from an in-memory database', () => {
    database = openDatabase(':memory:');

    writeMetadata(database, 'smoke-test', 'ok');

    expect(readMetadata(database, 'smoke-test')).toBe('ok');
  });

  it('updates existing metadata keys', () => {
    database = openDatabase(':memory:');

    writeMetadata(database, 'lesson-mode', 'slides');
    writeMetadata(database, 'lesson-mode', 'whiteboard');

    expect(readMetadata(database, 'lesson-mode')).toBe('whiteboard');
  });
});
