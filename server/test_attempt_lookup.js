// Quick test to verify the attempt lookup works with string testMongoId
// Run: node test_attempt_lookup.js
require("dotenv").config();
const mongoose = require("mongoose");
const MockAttempt = require("./models/MockAttempt");
const ExamRegistration = require("./models/ExamRegistration");
const Test = require("./models/Test");

async function test() {
  await mongoose.connect(process.env.MONGO_URI);

  // Find the test
  const test = await Test.findOne({ testId: "MTK-2026-8460" });
  console.log("Test found:", test ? test._id.toString() : "NOT FOUND");

  // Query with string testMongoId
  const attempts = await MockAttempt.find({ testMongoId: String(test._id) });
  console.log(`\nAttempts found with String(test._id): ${attempts.length}`);
  attempts.forEach((a) => {
    console.log(`  - attempt ${a.attemptNumber}: score=${a.score}/${a.totalMarks}, status=${a.status}`);
  });

  // Also try with the testId string
  const attemptsByTestId = await MockAttempt.find({ testId: test.testId });
  console.log(`\nAttempts found with testId "${test.testId}": ${attemptsByTestId.length}`);

  // Check registration mapping
  if (attempts.length > 0) {
    const reg = await ExamRegistration.findById(attempts[0].registrationId);
    console.log(`\nRegistration for first attempt: ${reg ? reg.registrationNumber : "NOT FOUND"}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

test().catch((err) => { console.error(err); process.exit(1); });