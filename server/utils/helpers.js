const jwt = require("jsonwebtoken");
const AdminLog = require("../models/AdminLog");

const generateToken = (adminId) => {
  return jwt.sign({ id: adminId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
};

// NFR-A-02
const logAction = async ({ adminId, action, targetCollection, targetId, details, ipAddress }) => {
  try {
    await AdminLog.create({ adminId, action, targetCollection, targetId, details, ipAddress });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
};

const generateTestId = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TST-${year}-${rand}`;
};

const generateMockTestId = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MTK-${year}-${rand}`;
};

module.exports = { generateToken, logAction, generateTestId, generateMockTestId };
