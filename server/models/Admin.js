const mongoose = require("mongoose");

// SRS Section 7: Admin { email, passwordHash, role (superadmin|admin), active, createdAt, createdBy }
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true }, // bcrypt hash, never plaintext (NFR-A-01)
    role: {
      type: String,
      enum: ["superadmin", "admin"],
      default: "admin",
    },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false }, // forces shipped Super Admin to rotate password (NFR-A-01)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
