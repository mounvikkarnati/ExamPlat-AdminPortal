const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { logAction } = require("../utils/helpers");

// @route GET /api/admins   (Section 3.2 - list of existing Admin accounts)
const listAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find().select("-password").sort({ createdAt: -1 });
  res.json(admins);
});

// @route POST /api/admins   (Section 3.2 - Create Admin action)
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and initial password are required");
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error("Initial password must be at least 8 characters");
  }

  const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (exists) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const admin = await Admin.create({
    name: name || "",
    email: email.toLowerCase().trim(),
    password: hashed,
    role: "admin",
    createdBy: req.admin._id,
  });

  await logAction({
    adminId: req.admin._id,
    action: "CREATE_ADMIN",
    targetCollection: "Admin",
    targetId: admin._id,
    details: { email: admin.email },
    ipAddress: req.ip,
  });

  const { password: _pw, ...safeAdmin } = admin.toObject();
  res.status(201).json(safeAdmin);
});

// @route PUT /api/admins/:id/disable   (Section 3.2 - disable, immediately revokes active sessions)
// Session revocation is enforced by the `protect` middleware re-checking `active` on every request.
const disableAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    res.status(404);
    throw new Error("Admin not found");
  }
  if (admin.role === "superadmin") {
    res.status(400);
    throw new Error("Cannot disable the Super Admin account");
  }

  admin.active = !admin.active; // toggle disable/re-enable
  await admin.save();

  await logAction({
    adminId: req.admin._id,
    action: admin.active ? "ENABLE_ADMIN" : "DISABLE_ADMIN",
    targetCollection: "Admin",
    targetId: admin._id,
    ipAddress: req.ip,
  });

  res.json({ id: admin._id, active: admin.active });
});

module.exports = { listAdmins, createAdmin, disableAdmin };
