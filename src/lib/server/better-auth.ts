import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const dataDir: string = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath: string = join(dataDir, 'gdluxx.db');
const db = new Database(dbPath);

try {
  const schemaPath: string = join(process.cwd(), 'src', 'lib', 'server', 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema: string = readFileSync(schemaPath, 'utf-8');

    const sessionInfo = db.pragma('table_info(session)') as Array<{ name: string }>;
    const hasTokenColumn: boolean = sessionInfo.some(
      (col: { name: string }): boolean => col.name === 'token'
    );

    if (!hasTokenColumn) {
      // eslint-disable-next-line no-console
      console.log('Migrating database schema to add token column...');
      db.exec('DROP TABLE IF EXISTS session');
      db.exec('DROP TABLE IF EXISTS account');
      db.exec('DROP TABLE IF EXISTS verification');
      db.exec('DROP TABLE IF EXISTS user');
    }
    db.exec(schema);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('Could not initialize database schema:', error);
}

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
