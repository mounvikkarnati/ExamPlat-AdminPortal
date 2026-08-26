const asyncHandler = require("express-async-handler");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const ExamRegistration = require("../models/ExamRegistration");
const Student = require("../models/Student");

// ---------------------------------------------------------------------------
// Field mapping
//   examregistrations.registrationNumber  →  Hall Ticket
//   examregistrations.examType            →  Booked Exams
//   examregistrations.status              →  Payment
//   examregistrations.registeredAt        →  Registered
//
//   students.name                         →  Student name
//   students.email                        →  Student email
//   students.phone                        →  Contact
// ---------------------------------------------------------------------------

const resolveStudent = (studentDoc) => {
  if (!studentDoc) return { name: "—", email: "", mobile: "" };
  const raw = studentDoc.toObject ? studentDoc.toObject() : studentDoc;
  return {
    name:
      raw.fullName ||
      raw.name ||
      `${raw.firstName || ""} ${raw.lastName || ""}`.trim() ||
      "—",
    email: raw.email || raw.emailId || "",
    mobile: raw.mobile || raw.phone || raw.mobileNumber || "",
  };
};

const normalizeRow = (regDoc, studentDoc) => {
  const raw = regDoc.toObject ? regDoc.toObject() : regDoc;
  const student = resolveStudent(studentDoc);

  const hallTicketNo = raw.registrationNumber || raw.hallTicket || "";

  const examTypeRaw = raw.examType || raw.exam || raw.course || "";
  const exams = Array.isArray(examTypeRaw)
    ? examTypeRaw.filter(Boolean)
    : examTypeRaw
    ? [String(examTypeRaw)]
    : [];

  const paymentStatus = String(
    raw.status ||
      raw.paymentStatus ||
      (raw.isPaid === true ? "Paid" : raw.isPaid === false ? "Unpaid" : "Pending")
  );

  const registeredAt = raw.registeredAt || raw.createdAt;

  return {
    id: raw._id,
    // From students collection
    name: student.name,
    email: student.email,
    mobile: student.mobile,
    // From examregistrations collection
    hallTicketNo,
    exams,
    paymentStatus,
    registeredAt,
  };
};

// Batch-enrich exam registrations with student data via studentId join
const enrichWithStudents = async (regDocs) => {
  // Collect unique studentIds from the registrations
  const studentIds = [
    ...new Set(
      regDocs
        .map((d) => {
          const raw = d.toObject ? d.toObject() : d;
          return raw.studentId ? String(raw.studentId) : null;
        })
        .filter(Boolean)
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  // Single batch query against students
  const studentMap = {};
  if (studentIds.length) {
    const students = await Student.find({ _id: { $in: studentIds } });
    for (const s of students) {
      studentMap[String(s._id)] = s;
    }
  }

  return regDocs.map((regDoc) => {
    const raw = regDoc.toObject ? regDoc.toObject() : regDoc;
    const studentDoc = raw.studentId ? studentMap[String(raw.studentId)] || null : null;
    return normalizeRow(regDoc, studentDoc);
  });
};

// Search filter on examregistrations fields
// examCategory optionally restricts results to a single booked exam (e.g. "JEE" or "NEET").
const buildFilter = (search, examCategory) => {
  const conditions = [];

  if (search) {
    const re = { $regex: search, $options: "i" };
    conditions.push({
      $or: [
        { registrationNumber: re },
        { examType: re },
        { status: re },
      ],
    });
  }

  if (examCategory && examCategory !== "All" && examCategory !== "all") {
    conditions.push({ examType: { $regex: examCategory, $options: "i" } });
  }

  return conditions.length ? { $and: conditions } : {};
};

// GET /api/students?search=&examCategory=JEE&page=1&limit=25
const listStudents = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 25, examCategory } = req.query;
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const filter = buildFilter(search, examCategory);

  const [regDocs, total] = await Promise.all([
    ExamRegistration.find(filter)
      .sort({ registeredAt: -1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    ExamRegistration.countDocuments(filter),
  ]);

  const students = await enrichWithStudents(regDocs);
  res.json({ students, total, page: safePage, limit: safeLimit });
});

// GET /api/students/export?search=&examCategory=JEE
const exportStudents = asyncHandler(async (req, res) => {
  const regDocs = await ExamRegistration.find(
    buildFilter(req.query.search || "", req.query.examCategory)
  ).sort({ registeredAt: -1, createdAt: -1 });

  const rows = await enrichWithStudents(regDocs);
  const xlsxRows = rows.map((r) => ({
    Name: r.name,
    Email: r.email,
    Mobile: r.mobile,
    "Hall Ticket No.": r.hallTicketNo,
    "Booked Exams": r.exams.join(", "),
    Payment: r.paymentStatus,
    "Registered On": r.registeredAt
      ? new Date(r.registeredAt).toLocaleDateString()
      : "",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(xlsxRows);
  sheet["!cols"] = [
    { wch: 24 }, { wch: 30 }, { wch: 16 },
    { wch: 18 }, { wch: 34 }, { wch: 16 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Exam Registrations");
  const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  res
    .setHeader("Content-Disposition", 'attachment; filename="examplat-exam-registrations.xlsx"')
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .send(file);
});

module.exports = { listStudents, exportStudents };
