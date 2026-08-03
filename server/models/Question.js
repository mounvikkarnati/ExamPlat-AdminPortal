const mongoose = require("mongoose");

// SRS Section 7: Question { testId, questionText, options[4], correctOption, subject/topic (optional) }
// Populated from either .xlsx or .json upload (Section 4.1) into one internal representation.
const questionSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    questionText: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 4 && arr.every((o) => o && o.trim().length > 0),
        message: "Each question must have exactly 4 non-empty options.",
      },
    },
    correctOption: { type: Number, required: true, min: 0, max: 3 }, // index into options[]
    subject: { type: String, trim: true, default: "" },
    topic: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    // CRITICAL: The student portal shares this same MongoDB database and its
    // Question model defines a stale unique index { testId: 1, questionId: 1 }.
    // autoIndex: false prevents Mongoose from syncing/creating indexes on this
    // collection when the admin server starts, so the stale index from the
    // student portal is never re-created by this app.
    autoIndex: false,
  }
);

module.exports = mongoose.model("Question", questionSchema);
