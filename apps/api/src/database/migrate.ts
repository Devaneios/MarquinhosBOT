import { db } from 'database/sqlite';
import * as fs from 'fs';
import * as path from 'path';

export function runMigrations() {
  db.run(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER)',
  );

  const migrationsDir = path.join(
    process.cwd(),
    'src',
    'database',
    'migrations',
  );

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const isApplied = db
      .query('SELECT 1 FROM schema_migrations WHERE version = ?')
      .get(file);

    if (!isApplied) {
      console.log(`[db] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      db.transaction(() => {
        // exec() handles multiple semicolons effectively in Bun
        db.run(sql);
        db.query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        ).run(file, Date.now());
      })();

      console.log(`[db] Applied ${file}`);
    }
  }
}
