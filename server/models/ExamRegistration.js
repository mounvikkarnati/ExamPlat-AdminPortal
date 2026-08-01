const mongoose = require("mongoose");

// Read-only view of the student portal's examregistrations collection.
// strict: false lets Mongoose surface any field the student portal stores.
const examRegistrationSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, trim: true }, // Hall Ticket
    examType: { type: String, trim: true },           // Booked Exams
    status: { type: String, trim: true },             // Payment
    registeredAt: { type: Date },                     // Registered
    // Common student-identity fields — kept loose so any variant works
    studentName: { type: String, trim: true },
    name: { type: String, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true, strict: false, collection: "examregistrations" }
);

examRegistrationSchema.index({
  registrationNumber: "text",
  examType: "text",
  email: "text",
  studentName: "text",
  name: "text",
  mobile: "text",
});

module.exports = mongoose.model("ExamRegistration", examRegistrationSchema);
