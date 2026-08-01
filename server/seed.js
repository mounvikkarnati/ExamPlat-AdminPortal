// Creates the single predefined Super Admin account (SRS Section 2.1) if it doesn't already exist.
// Run once: npm run seed
require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const Admin = require("./models/Admin");

(async () => {
  await connectDB();

  const email = (process.env.SUPERADMIN_EMAIL || "super.admin@examplat.com").toLowerCase();
  const plainPassword = process.env.SUPERADMIN_PASSWORD || "superAdmin@123";

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`Super Admin already exists (${email}). Nothing to do.`);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(plainPassword, salt);

  await Admin.create({
    name: "Super Admin",
    email,
    password,
    role: "superadmin",
    active: true,
    mustChangePassword: true, // NFR-A-01: must change on first login
  });

  console.log(`Super Admin created: ${email} (password must be changed on first login)`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
