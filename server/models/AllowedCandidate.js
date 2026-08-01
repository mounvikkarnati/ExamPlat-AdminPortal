const mongoose = require("mongoose");

// SRS Section 7: AllowedCandidate { testId, hallTicketNo, dob, startAt (override|inherited),
//   endAt (override|inherited), attemptsAllowed (override|inherited) }
// Section 5.3: fields left null mean "inherit the test default"; a non-null value is an explicit override.
const allowedCandidateSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    hallTicketNo: { type: String, required: true, trim: true },
    dob: { type: Date, default: null }, // used as the Student Portal login password

    startAtOverride: { type: Date, default: null },
    endAtOverride: { type: Date, default: null },
    attemptsOverride: { type: Number, default: null },

    // Oversight fields (Section 6) - primarily written by the Student Portal, read here for audit
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
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
      selectedOption: { type: Number, min: 0, max: 3 },
      answeredAt: { type: Date, default: null },
    }],
    resultPublishedAt: { type: Date, default: null },
    resultEmail: { type: String, trim: true, lowercase: true, default: "" },
    resultDeliveryError: { type: String, default: "" },
  },
  { timestamps: true }
);

allowedCandidateSchema.index({ testId: 1, hallTicketNo: 1 }, { unique: true });
// Server-side search across large allow-lists (NFR-A-05)
allowedCandidateSchema.index({ testId: 1, hallTicketNo: "text" });

module.exports = mongoose.model("AllowedCandidate", allowedCandidateSchema);
