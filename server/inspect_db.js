require("dotenv").config();
const mongoose = require("mongoose");

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  console.log("\n=== COLLECTIONS IN DB ===");
  const cols = await db.listCollections().toArray();
  console.log(cols.map(c => c.name).join(", "));

  console.log("\n=== examregistrations (first 3 docs) ===");
  const regs = await db.collection("examregistrations").find({}).limit(3).toArray();
  if (regs.length === 0) {
    console.log("NO DOCUMENTS FOUND in examregistrations");
  } else {
    regs.forEach((r, i) => {
      console.log(`\n-- doc ${i + 1} --`);
      console.log(JSON.stringify(r, null, 2));
    });
  }

  console.log("\n=== students (first 2 docs - key fields only) ===");
  const students = await db.collection("students").find({}).limit(2).toArray();
  if (students.length === 0) {
    console.log("NO DOCUMENTS FOUND in students");
  } else {
    students.forEach((s, i) => {
      console.log(`\n-- student ${i + 1} --`);
      console.log(JSON.stringify(s, null, 2));
    });
  }

  await mongoose.disconnect();
}

inspect().catch(err => { console.error(err); process.exit(1); });
