// Inspects students collection to understand the link between hallTicketNo and studentId.
// Run: node inspect_students.js
require("dotenv").config();
const mongoose = require("mongoose");

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  console.log("\n=== students (first 5 docs) ===");
  const students = await db.collection("students").find({}).limit(5).toArray();
  students.forEach((s, i) => {
    console.log(`\n-- doc ${i + 1} --`);
    console.log(JSON.stringify(s, null, 2));
  });

  console.log("\n=== examregistrations (first 5 docs) ===");
  const regs = await db.collection("examregistrations").find({}).limit(5).toArray();
  regs.forEach((r, i) => {
    console.log(`\n-- doc ${i + 1} --`);
    console.log(JSON.stringify(r, null, 2));
  });

  await mongoose.disconnect();
}

inspect().catch((err) => { console.error(err); process.exit(1); });