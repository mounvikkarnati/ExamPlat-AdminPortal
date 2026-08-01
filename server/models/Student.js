const mongoose = require("mongoose");

// The student portal owns this collection. Keep the schema permissive so the
// admin application can read registrations created by either portal version.
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },   // actual field in DB
    mobile: { type: String, trim: true },  // legacy alias
    hallTicketNo: { type: String, trim: true },
    paymentStatus: { type: String, trim: true },
    examBookings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, strict: false, collection: "students" }
);

studentSchema.index({ email: "text", name: "text", fullName: "text", phone: "text", mobile: "text" });
module.exports = mongoose.model("Student", studentSchema);
