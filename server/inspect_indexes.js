// Scans every collection in the database and lists all indexes,
// so we can spot any other stale indexes (like the questionId one we just dropped).
//
// Run: node inspect_indexes.js
require("dotenv").config();
const mongoose = require("mongoose");

async function inspectAllIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const cols = await db.listCollections().toArray();
  for (const { name } of cols) {
    const col = db.collection(name);
    const indexes = await col.indexes();
    console.log(`\n=== ${name} (${indexes.length} indexes) ===`);
    indexes.forEach((idx) => {
      const unique = idx.unique ? " UNIQUE" : "";
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}${unique}`);
    });
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

inspectAllIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});
