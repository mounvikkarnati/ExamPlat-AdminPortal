const mongoose = require("mongoose");

// Final examination questions, stored in the dedicated "finalquestions" collection.
const finalQuestionSchema = new mongoose.Schema(
  {
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "FinalExam", required: true },
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
  { timestamps: true }
);

finalQuestionSchema.index({ testId: 1 });

module.exports = mongoose.model("FinalQuestion", finalQuestionSchema);