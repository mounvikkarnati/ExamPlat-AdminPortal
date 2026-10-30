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

    // How long the exam lasts, entered separately: hours on a 24-hour clock (0-23)
    // and minutes (0-59).
    duration: {
      hours: {
        type: Number,
        default: 1,
        min: [0, "Duration hours must be between 0 and 23"],
        max: [23, "Duration hours must be between 0 and 23"],
        validate: { validator: Number.isInteger, message: "Duration hours must be a whole number" },
      },
      minutes: {
        type: Number,
        default: 0,
        min: [0, "Duration minutes must be between 0 and 59"],
        max: [59, "Duration minutes must be between 0 and 59"],
        validate: { validator: Number.isInteger, message: "Duration minutes must be a whole number" },
      },
    },

    status: {
      type: String,
      enum: ["Scheduled", "Live", "Completed"],
      default: "Scheduled",
    },

    candidateCount: { type: Number, default: 0 },
    resultsPublished: { type: Boolean, default: false },
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

// Validate the separately-entered duration (24-hour clock hours + minutes).
// Range/integer rules live on the paths above; this hook enforces the
// "total must be greater than zero" rule and defaults legacy exams to 1 hour.
finalExamSchema.pre("validate", function ensureValidDuration(next) {
  if (!this.duration || (this.duration.hours == null && this.duration.minutes == null)) {
    this.duration = { hours: 1, minutes: 0 };
  }
  const hours = Number(this.duration.hours);
  const minutes = Number(this.duration.minutes);
  if (hours === 0 && minutes === 0 && !this.$isValidationSkipped?.()) {
    return next(new Error("Exam duration must be greater than zero"));
  }
  next();
});

module.exports = mongoose.model("FinalExam", finalExamSchema);