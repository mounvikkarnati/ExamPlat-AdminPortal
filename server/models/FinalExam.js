const mongoose = require("mongoose");

// Final examinations are stored in their own "final"-prefixed collections so they
// are fully isolated from mock tests. This is the main exam record.
const finalExamSchema = new mongoose.Schema(
  {
    finalExamId: { type: String, required: true, unique: true }, // human-referenceable, e.g. FNL-2026-0001
    title: { type: String, required: true, trim: true },
    subject: { type: String, trim: true, default: "" },

    defaultStartAt: { type: Date, required: true },
    defaultEndAt: { type: Date, required: true },
    defaultAttempts: { type: Number, default: 1, min: 1 },

    status: {
      type: String,
      enum: ["Scheduled", "Live", "Completed"],
      default: "Scheduled",
    },

    candidateCount: { type: Number, default: 0 },
    resultsPublishedAt: { type: Date, default: null },
    resultsPublishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },

    examCategory: { type: String, enum: ["JEE", "NEET"], default: null },
    selectAllStudents: { type: Boolean, default: false },

    // Modify-access control: only the Super Admin (createdBy) can create/delete/publish.
    // Regular admins gain modify rights when allowAllAdmins is true OR they are in allowedAdmins.
    allowAllAdmins: { type: Boolean, default: false },
    allowedAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FinalExam", finalExamSchema);