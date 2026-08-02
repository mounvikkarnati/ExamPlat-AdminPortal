const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Admin = require("../models/Admin");

// FR-A-01: role is determined server-side from the account record, never trusted from the client.
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin || !admin.active) {
      res.status(401);
      throw new Error("Account disabled or not found");
    }

    req.admin = admin;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token invalid or expired");
  }
});

// Section 2.1 / FR-A-02: only role = superadmin may reach Manage Admins routes.
const superAdminOnly = (req, res, next) => {
  if (req.admin && req.admin.role === "superadmin") {
    return next();
  }
  res.status(403);
  throw new Error("Forbidden: Super Admin access required");
};

// A default credential is only safe when it cannot be used to operate the portal.
// Keep the password-change and profile endpoints reachable so the account can recover.
const requirePasswordChange = (req, res, next) => {
  if (req.admin?.mustChangePassword) {
    res.status(403);
    throw new Error("You must change your password before using the admin portal");
  }
  next();
};

// Mock tests may only be created by regular admins, not super admins.
const adminOnly = (req, res, next) => {
  if (req.admin && req.admin.role === "admin") {
    return next();
  }
  res.status(403);
  throw new Error("Forbidden: Admin access required");
};

module.exports = { protect, superAdminOnly, adminOnly, requirePasswordChange };
