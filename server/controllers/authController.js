const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { generateToken, logAction } = require("../utils/helpers");

// @route POST /api/auth/login   (FR-A-01)
// Single login form for both Admin and Super Admin; role read from the DB record, not the client.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

  if (!admin || !admin.active) {
    res.status(401);
    throw new Error("Invalid credentials or account disabled");
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  admin.lastLogin = new Date();
  await admin.save();

  await logAction({
    adminId: admin._id,
    action: "LOGIN",
    ipAddress: req.ip,
  });

  res.json({
    token: generateToken(admin._id),
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword,
    },
  });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});

// @route PUT /api/auth/change-password  (NFR-A-01: shipped Super Admin must change password on first login)
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    res.status(400);
    throw new Error("New password must be at least 8 characters");
  }

  const admin = await Admin.findById(req.admin._id);
  const match = await bcrypt.compare(currentPassword, admin.password);
  if (!match) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  const salt = await bcrypt.genSalt(10);
  admin.password = await bcrypt.hash(newPassword, salt);
  admin.mustChangePassword = false;
  await admin.save();

  await logAction({ adminId: admin._id, action: "CHANGE_PASSWORD", ipAddress: req.ip });

  res.json({ message: "Password updated successfully" });
});

module.exports = { login, getMe, changePassword };
