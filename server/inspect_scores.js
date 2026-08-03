// Inspects how scores are stored across collections to understand the data model.
// Run: node inspect_scores.js
require("dotenv").config();
const mongoose = require("mongoose");

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  console.log("\n=== allowedcandidates (first 3 docs) ===");
  const cands = await db.collection("allowedcandidates").find({}).limit(3).toArray();
  cands.forEach((c, i) => {
    console.log(`\n-- doc ${i + 1} --`);
    console.log(JSON.stringify(c, null, 2));
  });

  console.log("\n=== mockattempts (first 3 docs) ===");
  const attempts = await db.collection("mockattempts").find({}).limit(3).toArray();
  attempts.forEach((a, i) => {
    console.log(`\n-- doc ${i + 1} --`);
    console.log(JSON.stringify(a, null, 2));
  });

  console.log("\n=== tests (first 2 docs) ===");
  const tests = await db.collection("tests").find({}).limit(2).toArray();
  tests.forEach((t, i) => {
    console.log(`\n-- doc ${i + 1} --`);
    console.log(JSON.stringify(t, null, 2));
  });

  await mongoose.disconnect();
}

inspect().catch((err) => { console.error(err); process.exit(1); });