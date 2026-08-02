const mongoose = require("mongoose");

// SRS Section 7: Test { testId, title, questionBankRef, defaultStartAt, defaultEndAt, defaultAttempts, status, createdBy, createdAt }
const testSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, unique: true }, // human-referenceable, e.g. TST-2026-0001
    title: { type: String, required: true, trim: true },
    subject: { type: String, trim: true, default: "" },

    // Section 4.2 - the date portion is fixed at creation; only time-of-day is editable later (Section 5.2)
    defaultStartAt: { type: Date, required: true },
    defaultEndAt: { type: Date, required: true },

    defaultAttempts: { type: Number, default: 1, min: 1 }, // Section 5.2

    status: {
      type: String,
      enum: ["Scheduled", "Live", "Completed"],
      default: "Scheduled",
    },

    candidateCount: { type: Number, default: 0 },
    resultsPublishedAt: { type: Date, default: null },
    resultsPublishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },

    testType: { type: String, enum: ["scheduled", "mock"], default: "scheduled" },
    examCategory: { type: String, enum: ["JEE", "NEET"], default: null },
    selectAllStudents: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", testSchema);
