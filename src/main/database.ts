import Database from 'better-sqlite3';

export type AppDatabase = Database.Database;

export function openDatabase(databasePath: string): AppDatabase {
  const database = new Database(databasePath);
  initializeDatabase(database);

  return database;
}

export function initializeDatabase(database: AppDatabase): void {
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
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
