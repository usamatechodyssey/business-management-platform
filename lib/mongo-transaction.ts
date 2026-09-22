// lib/mongo-transaction.ts
//
// Shared MongoDB transaction helper. Extracted when a third caller
// (lib/sales.ts) needed the same withTransaction + ValidationError
// pattern that lib/suppliers.ts and lib/customers.ts already had.
// MongoDB Atlas (all tiers) is a replica set, so multi-document
// transactions work everywhere this app is deployed.

import { getClient } from "@/lib/db";
import type { ClientSession } from "mongodb";

// Thrown by transactional callbacks to abort the transaction on a
// business-rule failure (missing resource, over-payment, insufficient
// stock, etc.). Public functions catch it and map to a
// discriminated-union error so API routes stay clean.
export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    // Optional structured context (e.g. which product was out of stock).
    // Public callers map this into the discriminated-union response so
    // API routes can pass it through to the client without string parsing.
    public readonly details?: Record<string, unknown>
  ) {
    super(code);
    this.name = "ValidationError";
  }
}

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const client = await getClient();
  const session = client.startSession();
  try {
    const result = await session.withTransaction(() => fn(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    if (result === undefined) {
      // withTransaction returns undefined only if it aborted without
      // running the callback — shouldn't happen given our usage.
      throw new Error("Transaction aborted without a result.");
    }
    return result;
  } finally {
    await session.endSession();
  }
}