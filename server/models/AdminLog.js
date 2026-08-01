const mongoose = require("mongoose");

// NFR-A-02: all test-schedule and attempt-limit edits are logged with which Admin made the change and when.
const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    action: { type: String, required: true }, // e.g. "CREATE_TEST", "MODIFY_SCHEDULE", "GRANT_ATTEMPT"
    targetCollection: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminLog", adminLogSchema);
