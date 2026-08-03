// One-off maintenance script: drops the stale unique compound index
// "testId_1_questionId_1" from the questions collection.
//
// The current Question schema has no questionId field, so every document
// stores questionId: null. The old unique index then rejects the 2nd+
// question for the same test with E11000.
//
// Run: node fix_question_index.js
require("dotenv").config();
const mongoose = require("mongoose");

async function fixIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection("questions");

  console.log("\n=== Current indexes on questions ===");
  const indexes = await col.indexes();
  indexes.forEach((idx) => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  const stale = indexes.filter((idx) => idx.key.questionId !== undefined);
  if (stale.length === 0) {
    console.log("\nNo stale questionId index found. Nothing to do.");
  } else {
    for (const idx of stale) {
      console.log(`\nDropping stale index: ${idx.name}`);
      await col.dropIndex(idx.name);
      console.log(`Dropped ${idx.name}`);
    }
  }

  console.log("\n=== Indexes after cleanup ===");
  const after = await col.indexes();
  after.forEach((idx) => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  await mongoose.disconnect();
  console.log("\nDone.");
}

fixIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});