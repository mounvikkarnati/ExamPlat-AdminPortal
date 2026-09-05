const mongoose = require("mongoose");

// Allow-list / per-candidate data for final examinations, stored in the
// dedicated "finalallowedcandidates" collection.
const finalAllowedCandidateSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalExam", required: true },
    hallTicketNo: { type: String, required: true, trim: true },
    dob: { type: Date, default: null }, // used as the Student Portal login password

    startAtOverride: { type: Date, default: null },
    endAtOverride: { type: Date, default: null },
    attemptsOverride: { type: Number, default: null },

    // Oversight fields - primarily written by the Student Portal, read here for audit
    status: {
      type: String,
      enum: ["not started", "in progress", "submitted", "auto-submitted"],
      default: "not started",
    },
    submissionReason: { type: String, default: "" },
    violations: [
      {
        type: { type: String },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, default: "" },
      },
    ],
    score: { type: Number, default: null },
    attemptsUsed: { type: Number, default: 0 },
    responses: [{
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalQuestion" },
      selectedOption: { type: Number, min: 0, max: 3 },
      answeredAt: { type: Date, default: null },
    }],
    resultPublishedAt: { type: Date, default: null },
    resultEmail: { type: String, trim: true, lowercase: true, default: "" },
    resultDeliveryError: { type: String, default: "" },
  },
  {
    timestamps: true,
    // CRITICAL: The student portal shares this same MongoDB database and may have
    // created a stale unique index { candidateId: 1, examId: 1 } on this collection
    // using older field names. autoIndex: false prevents Mongoose from syncing/
    // creating indexes here, avoiding conflicts with the student portal's indexes.
    // The correct indexes are ensured by the startup cleanup in server.js.
    autoIndex: false,
  }
);

finalAllowedCandidateSchema.index({ testId: 1, hallTicketNo: 1 }, { unique: true });
// Server-side search across large allow-lists
finalAllowedCandidateSchema.index({ testId: 1, hallTicketNo: "text" });

module.exports = mongoose.model("FinalAllowedCandidate", finalAllowedCandidateSchema);