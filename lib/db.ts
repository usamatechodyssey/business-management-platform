import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const DB_NAME = "business_management";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
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

  const client = new MongoClient(uri);

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

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

export async function checkDbHealth(): Promise <
  { connected: true } | { connected: false; error: string }
> {
  if (!uri) {
    return { connected: false, error: "MONGODB_URI is not set in environment variables." };
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