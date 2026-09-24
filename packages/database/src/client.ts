import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run a query: the pool itself or an open transaction. */
export type DbExecutor = Db | Tx;

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 10);

export function createDb(url: string, poolMax: number = POOL_MAX): DbHandle {
  const client = postgres(url, { max: poolMax, onnotice: () => undefined });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  return url;
}

let defaultHandle: DbHandle | undefined;

function defaultDbHandle(): DbHandle {
  defaultHandle ??= createDb(requireDatabaseUrl());
  return defaultHandle;
}

// Resolved on first use so importing a service module never needs a URL —
// only touching the database does.
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const target = defaultDbHandle().db;
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export async function closeDefaultDb(): Promise<void> {
  if (!defaultHandle) return;
  const handle = defaultHandle;
  defaultHandle = undefined;
  await handle.close();
}
