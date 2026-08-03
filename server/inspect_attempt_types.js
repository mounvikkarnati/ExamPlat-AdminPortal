// Check the actual data types in mockattempts collection
// Run: node inspect_attempt_types.js
require("dotenv").config();
const mongoose = require("mongoose");

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const attempts = await db.collection("mockattempts").find({}).limit(3).toArray();
  attempts.forEach((a, i) => {
    console.log(`\n-- attempt ${i + 1} --`);
    console.log(`testId: ${typeof a.testId} = ${JSON.stringify(a.testId)}`);
    console.log(`testMongoId: ${typeof a.testMongoId} = ${JSON.stringify(a.testMongoId)}`);
    console.log(`studentId: ${typeof a.studentId} = ${JSON.stringify(a.studentId)}`);
    console.log(`registrationId: ${typeof a.registrationId} = ${JSON.stringify(a.registrationId)}`);
    console.log(`is testMongoId ObjectId: ${a.testMongoId instanceof mongoose.Types.ObjectId}`);
    console.log(`is registrationId ObjectId: ${a.registrationId instanceof mongoose.Types.ObjectId}`);
  });

  // Also check the test
  const test = await db.collection("tests").findOne({ testId: "MTK-2026-8460" });
  if (test) {
    console.log(`\n=== Test MTK-2026-8460 ===`);
    console.log(`_id: ${typeof test._id} = ${JSON.stringify(test._id)}`);
    console.log(`testId: ${typeof test.testId} = ${JSON.stringify(test.testId)}`);
    console.log(`is _id ObjectId: ${test._id instanceof mongoose.Types.ObjectId}`);
  }

  await mongoose.disconnect();
}

inspect().catch((err) => { console.error(err); process.exit(1); });