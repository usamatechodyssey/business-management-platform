#!/usr/bin/env node
//
// Bootstrap CLI for creating the first (or subsequent) platform admin.
// Admin accounts are intentionally not creatable through any API — this
// script is the only way to mint one, which keeps the surface minimal.
//
// Usage:
//   node --env-file=.env.local scripts/create-admin.js \
//     admin@example.com "S3curePassword" "Admin Name"
//
// Node 20.10+ supports --env-file natively (no dotenv dependency).

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const DB_NAME = "business_management";

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error(
      "Usage: node --env-file=.env.local scripts/create-admin.js <email> <password> <name>"
    );
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Error: email is not valid.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Error: password must be at least 8 characters.");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "Error: MONGODB_URI is not set. Did you pass --env-file=.env.local ?"
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const admins = db.collection("adminUsers");

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await admins.findOne({ email: normalizedEmail });
    if (existing) {
      console.error(`Error: an admin with email "${normalizedEmail}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await admins.insertOne({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      active: true,
      createdAt: now,
    });

    console.log(`✓ Admin created: ${normalizedEmail}`);
    console.log("  Login at /admin/login");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});