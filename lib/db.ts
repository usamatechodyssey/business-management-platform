// lib/db.ts

import { MongoClient, Db, Collection, Document, WithId } from "mongodb";
import { ensureIndexes } from "@/lib/db-indexes";

const uri = process.env.MONGODB_URI;
const DB_NAME = "business_management";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoIndexesPromise: Promise<void> | undefined;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("MONGODB_URI is not set in environment variables.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let clientPromise: Promise<MongoClient> | undefined;

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new DatabaseNotConfiguredError();
  }

  const client = new MongoClient(uri, { ignoreUndefined: true });

  if (process.env.NODE_ENV === "development") {
    // Reuse the same connection across hot reloads in dev
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  // Reuse the same connection across serverless invocations in prod
  if (!clientPromise) {
    clientPromise = client.connect();
  }
  return clientPromise;
}

// ── _id stripping wrapper ───────────────────────────────────────
//
// MongoDB documents carry an `_id` (ObjectId). ObjectId instances have a
// `toJSON` method, which React refuses to serialize across the Server →
// Client Component boundary — and our own domain types use a string `id`
// field instead, so `_id` is always redundant for us.
//
// We wrap the `Db` once, right here. Every read (find / findOne /
// findOneAndUpdate / findOneAndDelete) transparently returns documents
// without `_id`. Everything downstream — lib functions, page components,
// API routes — adapts automatically.
//
// We deliberately do NOT wrap `aggregate()`. Aggregation pipelines use
// `_id` as a *group key* (e.g. `$group: { _id: "$date" }`), which is a
// legitimate value our report code reads via `row._id`. That `_id` is
// not a MongoDB document id and must be preserved.

function stripId<D extends Document>(doc: WithId<D> | null): D | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as unknown as D;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any;

function wrapCollectionForClient<T extends Document>(
  collection: Collection<T>
): Collection<T> {
  const c = collection as AnyCollection;

  const originalFind = c.find.bind(collection);
  c.find = function (...args: unknown[]) {
    const cursor = originalFind(...args);
    const originalToArray = cursor.toArray.bind(cursor);
    const originalNext = cursor.next.bind(cursor);

    cursor.toArray = async () => {
      const docs = await originalToArray();
      return docs.map((d: WithId<Document>) => stripId(d));
    };
    cursor.next = async () => {
      const doc = await originalNext();
      return stripId(doc);
    };
    return cursor;
  };

  const originalFindOne = c.findOne.bind(collection);
  c.findOne = async function (...args: unknown[]) {
    const doc = await originalFindOne(...args);
    return stripId(doc);
  };

  const originalFindOneAndUpdate = c.findOneAndUpdate.bind(collection);
  c.findOneAndUpdate = async function (...args: unknown[]) {
    const doc = await originalFindOneAndUpdate(...args);
    return stripId(doc);
  };

  const originalFindOneAndReplace = c.findOneAndReplace.bind(collection);
  c.findOneAndReplace = async function (...args: unknown[]) {
    const doc = await originalFindOneAndReplace(...args);
    return stripId(doc);
  };

  const originalFindOneAndDelete = c.findOneAndDelete.bind(collection);
  c.findOneAndDelete = async function (...args: unknown[]) {
    const doc = await originalFindOneAndDelete(...args);
    return stripId(doc);
  };

  return collection;
}

function wrapDbForClient(db: Db): Db {
  const d = db as AnyCollection;
  const originalCollection = d.collection.bind(db);
  d.collection = function (name: string) {
    return wrapCollectionForClient(originalCollection(name));
  };
  return db;
}

// ── Index bootstrap ─────────────────────────────────────────────
//
// ensureIndexes() is idempotent, so we fire it once per process after
// the first successful connection. It is NOT awaited on the hot path:
// a request that arrives before indexes finish still works (MongoDB
// falls back to a collection scan). By the second request indexes are
// almost always in place.
//
// The memoization key lives on `global` so hot reloads in dev don't
// re-trigger index creation on every file save.

function bootstrapIndexes(db: Db): void {
  if (process.env.NODE_ENV === "development") {
    if (global._mongoIndexesPromise) return;
    global._mongoIndexesPromise = ensureIndexes(db).catch((err) => {
      // Reset so the next request retries rather than leaving indexes
      // permanently un-created.
      global._mongoIndexesPromise = undefined;
      console.error("[db] Index bootstrap failed:", err);
    });
    return;
  }

  // Production / serverless: same idea but with a module-level memo.
  // Each cold start re-runs it, which is exactly what we want.
  if (indexesPromise) return;
  indexesPromise = ensureIndexes(db).catch((err) => {
    indexesPromise = undefined;
    console.error("[db] Index bootstrap failed:", err);
  });
}

let indexesPromise: Promise<void> | undefined;

// ── Public API ──────────────────────────────────────────────────

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = wrapDbForClient(client.db(DB_NAME));
  bootstrapIndexes(db);
  return db;
}

export async function checkDbHealth(): Promise<
  { connected: true } | { connected: false; error: string }
> {
  if (!uri) {
    return {
      connected: false,
      error: "MONGODB_URI is not set in environment variables.",
    };
  }
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { connected: true };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}