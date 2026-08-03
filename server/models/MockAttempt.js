const mongoose = require("mongoose");

// Read-only view of the student portal's mockattempts collection.
// strict: false lets Mongoose surface any field the student portal stores.
const mockAttemptSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRegistration" },
    testId: { type: String, trim: true }, // human-readable test ID e.g. MTK-2026-8460
    testMongoId: { type: String, trim: true }, // stored as STRING in the student portal
    examType: { type: String, trim: true },
    attemptNumber: { type: Number, default: 1 },
    status: { type: String, trim: true },
    score: { type: Number, default: null },
    totalMarks: { type: Number, default: null },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },
    startedAt: { type: Date },
    testTitle: { type: String, trim: true },
    examCategory: { type: String, trim: true },
    submittedAt: { type: Date },
  },
  { timestamps: true, strict: false, collection: "mockattempts" }
);

mockAttemptSchema.index({ studentId: 1, testId: 1, attemptNumber: 1 }, { unique: true });
mockAttemptSchema.index({ testMongoId: 1 });

module.exports = mongoose.model("MockAttempt", mockAttemptSchema);