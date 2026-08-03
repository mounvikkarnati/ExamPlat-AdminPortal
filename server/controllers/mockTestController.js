const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Test = require("../models/Test");
const Question = require("../models/Question");
const AllowedCandidate = require("../models/AllowedCandidate");
const ExamRegistration = require("../models/ExamRegistration");
const Student = require("../models/Student");
const MockAttempt = require("../models/MockAttempt");
const { parseQuestionFile, parseCandidateFile } = require("../utils/parseUploads");
const { generateMockTestId, logAction } = require("../utils/helpers");
const { makeResponsePdf, sendResultEmail } = require("../utils/resultDelivery");

const MAX_ATTEMPTS = 20;
const EXAM_CATEGORIES = ["JEE", "NEET"];

// The student portal shares this MongoDB and its Question model defines a stale
// unique index { testId: 1, questionId: 1 }. That index rejects the 2nd+ question
// for the same test with E11000. Drop it right before inserting questions so test
// creation never fails, even if the student portal recreates the index.
const dropStaleQuestionIndex = async () => {
  try {
    const db = mongoose.connection.db;
    const col = db.collection("questions");
    const indexes = await col.indexes();
    const stale = indexes.filter((idx) => idx.key.questionId !== undefined);
    for (const idx of stale) {
      await col.dropIndex(idx.name);
    }
  } catch (err) {
    // Non-fatal: index may already be gone or collection may not exist yet.
  }
};

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
const validAttemptCount = (value) =>
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= MAX_ATTEMPTS;

const currentStatus = (test) => {
  const now = Date.now();
  if (new Date(test.defaultEndAt).getTime() < now) return "Completed";
  if (new Date(test.defaultStartAt).getTime() <= now) return "Live";
  return "Scheduled";
};

const withCurrentStatus = (test) => ({ ...test.toObject(), status: currentStatus(test) });

const findMockTestOrThrow = async (id, res) => {
  const test = await Test.findOne({ _id: id, testType: "mock" }).populate("createdBy", "name role");
  if (!test) {
    res.status(404);
    throw new Error("Mock test not found");
  }
  return test;
};

const isMockTestCreator = (test, admin) =>
  admin && test.createdBy && String(test.createdBy._id || test.createdBy) === String(admin._id);

const assertCanManageMockTest = (test, admin, res) => {
  if (!isMockTestCreator(test, admin)) {
    res.status(403);
    throw new Error("Only the admin who created this mock test can manage it");
  }
};

const examCategoryFilter = (examCategory) => ({
  examType: { $regex: examCategory, $options: "i" },
  registrationNumber: { $exists: true, $ne: "" },
});

const fetchCandidatesFromExamRegistrations = async (examCategory) => {
  const registrations = await ExamRegistration.find(examCategoryFilter(examCategory));
  const seen = new Set();
  const candidates = [];

  for (const reg of registrations) {
    const hallTicketNo = String(reg.registrationNumber || "").trim();
    if (!hallTicketNo || seen.has(hallTicketNo)) continue;
    seen.add(hallTicketNo);
    candidates.push({ hallTicketNo, dob: null });
  }

  return candidates;
};

// @route GET /api/mock-tests/eligible-count?examCategory=JEE
const eligibleStudentCount = asyncHandler(async (req, res) => {
  const { examCategory } = req.query;
  if (!EXAM_CATEGORIES.includes(examCategory)) {
    res.status(400);
    throw new Error("examCategory must be JEE or NEET");
  }
  const candidates = await fetchCandidatesFromExamRegistrations(examCategory);
  res.json({ examCategory, count: candidates.length });
});

// @route POST /api/mock-tests
const createMockTest = asyncHandler(async (req, res) => {
  if (req.admin?.role !== "admin") {
    res.status(403);
    throw new Error("Forbidden: Admin access required");
  }

  const { title, subject, startAt, endAt, defaultAttempts, examCategory, selectAllStudents } = req.body;
  const questionFile = req.files?.questionFile?.[0];
  const candidateFile = req.files?.candidateFile?.[0];
  const enrollAll = selectAllStudents === "true" || selectAllStudents === true;

  if (!title || !startAt || !endAt || !questionFile || !EXAM_CATEGORIES.includes(examCategory)) {
    res.status(400);
    throw new Error("Title, schedule, exam category (JEE or NEET), and a question file are required");
  }
  if (!enrollAll && !candidateFile) {
    res.status(400);
    throw new Error("Upload a candidate file or choose Select all students");
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate <= startDate) {
    res.status(400);
    throw new Error("End date and time must be after the start date and time");
  }
  if (!validAttemptCount(defaultAttempts ?? 1)) {
    res.status(400);
    throw new Error(`Default attempts must be a whole number from 1 to ${MAX_ATTEMPTS}`);
  }

  const { questions, errors: questionErrors } = parseQuestionFile(questionFile);
  let candidates = [];
  let candidateErrors = [];

  if (enrollAll) {
    candidates = await fetchCandidatesFromExamRegistrations(examCategory);
    if (candidates.length === 0) {
      candidateErrors = [`No registered ${examCategory} students found`];
    }
  } else {
    const parsed = parseCandidateFile(candidateFile);
    candidates = parsed.candidates;
    candidateErrors = parsed.errors;
  }

  if (questionErrors.length > 0 || questions.length === 0) {
    return res.status(422).json({
      message: "Question upload failed validation",
      questionErrors,
      candidateErrors,
    });
  }
  if (candidateErrors.length > 0 || candidates.length === 0) {
    return res.status(422).json({
      message: enrollAll ? "No eligible students found" : "Candidate upload failed validation",
      questionErrors,
      candidateErrors,
    });
  }

  let testId;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateId = generateMockTestId();
    if (!(await Test.exists({ testId: candidateId }))) {
      testId = candidateId;
      break;
    }
  }
  if (!testId) {
    res.status(503);
    throw new Error("Could not allocate a unique mock test ID. Please try again.");
  }

  const test = await Test.create({
    testId,
    title,
    subject: subject || "",
    defaultStartAt: startDate,
    defaultEndAt: endDate,
    defaultAttempts: Number(defaultAttempts ?? 1),
    status: "Scheduled",
    candidateCount: candidates.length,
    testType: "mock",
    examCategory,
    selectAllStudents: enrollAll,
    createdBy: req.admin._id,
  });

  await test.populate("createdBy", "name role");

  // Safety net: drop the stale student-portal index before inserting questions
  await dropStaleQuestionIndex();
  await Question.insertMany(questions.map((q) => ({ ...q, testId: test._id })));

  await AllowedCandidate.insertMany(
    candidates.map((c) => ({
      testId: test._id,
      hallTicketNo: c.hallTicketNo,
      dob: c.dob,
      startAtOverride: null,
      endAtOverride: null,
      attemptsOverride: null,
    }))
  );

  await logAction({
    adminId: req.admin._id,
    action: "CREATE_MOCK_TEST",
    targetCollection: "Test",
    targetId: test._id,
    details: {
      testId,
      examCategory,
      selectAllStudents: enrollAll,
      questionCount: questions.length,
      candidateCount: candidates.length,
    },
    ipAddress: req.ip,
  });

  res.status(201).json({
    test: withCurrentStatus(test),
    questionCount: questions.length,
    candidateCount: candidates.length,
  });
});

// @route GET /api/mock-tests
const listMockTests = asyncHandler(async (req, res) => {
  const tests = await Test.find({ testType: "mock" })
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });
  res.json(tests.map(withCurrentStatus));
});

// @route GET /api/mock-tests/:id
const getMockTest = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.id, res);
  const questionCount = await Question.countDocuments({ testId: test._id });
  res.json({
    test: withCurrentStatus(test),
    questionCount,
    canManage: isMockTestCreator(test, req.admin),
  });
});

// @route DELETE /api/mock-tests/:id — creator admin only
const deleteMockTest = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.id, res);
  assertCanManageMockTest(test, req.admin, res);

  await Promise.all([
    Question.deleteMany({ testId: test._id }),
    AllowedCandidate.deleteMany({ testId: test._id }),
  ]);

  await Test.findByIdAndDelete(test._id);

  await logAction({
    adminId: req.admin._id,
    action: "DELETE_MOCK_TEST",
    targetCollection: "Test",
    targetId: test._id,
    details: { title: test.title, testId: test.testId },
    ipAddress: req.ip,
  });

  res.json({ message: "Mock test deleted successfully", testId: test.testId });
});

// @route PUT /api/mock-tests/:id — creator admin only
// Now accepts full datetime-local values (startAt/endAt) so the admin can edit the date as well.
const modifyMockTestDefaults = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.id, res);
  assertCanManageMockTest(test, req.admin, res);

  const { startAt, endAt, startTime, endTime, defaultAttempts } = req.body;

  const before = {
    defaultStartAt: test.defaultStartAt,
    defaultEndAt: test.defaultEndAt,
    defaultAttempts: test.defaultAttempts,
  };

  // Support both full datetime (startAt/endAt) and time-only (startTime/endTime) formats
  if (startAt) {
    const parsed = new Date(startAt);
    if (!isValidDate(parsed)) {
      res.status(400);
      throw new Error("Start date and time must be valid");
    }
    test.defaultStartAt = parsed;
  } else if (startTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      res.status(400);
      throw new Error("Start time must be in HH:mm format");
    }
    const [h, m] = startTime.split(":").map(Number);
    const d = new Date(test.defaultStartAt);
    d.setHours(h, m, 0, 0);
    test.defaultStartAt = d;
  }

  if (endAt) {
    const parsed = new Date(endAt);
    if (!isValidDate(parsed)) {
      res.status(400);
      throw new Error("End date and time must be valid");
    }
    test.defaultEndAt = parsed;
  } else if (endTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      res.status(400);
      throw new Error("End time must be in HH:mm format");
    }
    const [h, m] = endTime.split(":").map(Number);
    const d = new Date(test.defaultEndAt);
    d.setHours(h, m, 0, 0);
    test.defaultEndAt = d;
  }

  if (!test.defaultStartAt || !test.defaultEndAt || test.defaultEndAt <= test.defaultStartAt) {
    res.status(400);
    throw new Error("Provide valid dates/times with an end after the start");
  }
  if (defaultAttempts !== undefined && defaultAttempts !== "") {
    if (!validAttemptCount(defaultAttempts)) {
      res.status(400);
      throw new Error(`Default attempts must be a whole number from 1 to ${MAX_ATTEMPTS}`);
    }
    test.defaultAttempts = Number(defaultAttempts);
  }

  await test.save();

  await logAction({
    adminId: req.admin._id,
    action: "MODIFY_MOCK_TEST_DEFAULTS",
    targetCollection: "Test",
    targetId: test._id,
    details: {
      before,
      after: {
        defaultStartAt: test.defaultStartAt,
        defaultEndAt: test.defaultEndAt,
        defaultAttempts: test.defaultAttempts,
      },
    },
    ipAddress: req.ip,
  });

  res.json(withCurrentStatus(test));
});

// @route GET /api/mock-tests/:id/candidates
// Now fetches scores from the mockattempts collection and joins them by hall ticket.
const listCandidates = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 25 } = req.query;
  const test = await findMockTestOrThrow(req.params.id, res);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const filter = { testId: req.params.id };
  if (search) {
    filter.hallTicketNo = { $regex: search, $options: "i" };
  }

  const skip = (safePage - 1) * safeLimit;
  const [candidates, total] = await Promise.all([
    AllowedCandidate.find(filter).sort({ hallTicketNo: 1 }).skip(skip).limit(safeLimit),
    AllowedCandidate.countDocuments(filter),
  ]);

  // Fetch scores from mockattempts for this test
  // NOTE: testMongoId is stored as a STRING in the mockattempts collection
  const attempts = await MockAttempt.find({ testMongoId: String(test._id) });
  const scoreByHallTicket = new Map();
  for (const a of attempts) {
    // Find the registration to map studentId -> hallTicketNo
    const reg = await ExamRegistration.findById(a.registrationId);
    if (reg && reg.registrationNumber) {
      const hallTicket = String(reg.registrationNumber).trim();
      if (!scoreByHallTicket.has(hallTicket) || (a.attemptNumber || 1) > (scoreByHallTicket.get(hallTicket)?.attemptNumber || 0)) {
        scoreByHallTicket.set(hallTicket, a);
      }
    }
  }

  const enriched = candidates.map((c) => {
    const obj = c.toObject();
    const attempt = scoreByHallTicket.get(c.hallTicketNo);
    if (attempt) {
      obj.score = attempt.score;
      obj.totalMarks = attempt.totalMarks;
      obj.attemptNumber = attempt.attemptNumber;
      obj.percentage = attempt.percentage;
      obj.attemptStatus = attempt.status;
    }
    return obj;
  });

  res.json({ candidates: enriched, total, page: safePage, limit: safeLimit });
});

// @route POST /api/mock-tests/:id/candidates — creator admin only
const addCandidate = asyncHandler(async (req, res) => {
  const { hallTicketNo, dob } = req.body;
  if (!hallTicketNo) {
    res.status(400);
    throw new Error("Hall Ticket No. is required");
  }

  const test = await findMockTestOrThrow(req.params.id, res);
  assertCanManageMockTest(test, req.admin, res);

  const normalizedTicket = hallTicketNo.trim();
  const exists = await AllowedCandidate.findOne({ testId: req.params.id, hallTicketNo: normalizedTicket });
  if (exists) {
    res.status(409);
    throw new Error("This Hall Ticket No. is already on the allow-list for this mock test");
  }

  const candidate = await AllowedCandidate.create({
    testId: req.params.id,
    hallTicketNo: normalizedTicket,
    dob: dob ? new Date(dob) : null,
  });

  await Test.findByIdAndUpdate(req.params.id, { $inc: { candidateCount: 1 } });

  await logAction({
    adminId: req.admin._id,
    action: "ADD_MOCK_TEST_CANDIDATE",
    targetCollection: "AllowedCandidate",
    targetId: candidate._id,
    details: { hallTicketNo: normalizedTicket },
    ipAddress: req.ip,
  });

  res.status(201).json(candidate);
});

// @route PUT /api/mock-tests/:testId/candidates/:candidateId — creator admin only
const updateCandidate = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.testId, res);
  assertCanManageMockTest(test, req.admin, res);

  const candidate = await AllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this mock test");
  }

  const { startAtOverride, endAtOverride, attemptsOverride } = req.body;
  const before = {
    startAtOverride: candidate.startAtOverride,
    endAtOverride: candidate.endAtOverride,
    attemptsOverride: candidate.attemptsOverride,
  };

  const parsedStart = startAtOverride ? new Date(startAtOverride) : null;
  const parsedEnd = endAtOverride ? new Date(endAtOverride) : null;
  if ((startAtOverride && !isValidDate(parsedStart)) || (endAtOverride && !isValidDate(parsedEnd))) {
    res.status(400);
    throw new Error("Candidate overrides must contain valid dates and times");
  }
  if (attemptsOverride !== undefined && attemptsOverride !== "" && !validAttemptCount(attemptsOverride)) {
    res.status(400);
    throw new Error(`Attempt override must be a whole number from 1 to ${MAX_ATTEMPTS}`);
  }
  if (startAtOverride !== undefined) candidate.startAtOverride = parsedStart;
  if (endAtOverride !== undefined) candidate.endAtOverride = parsedEnd;
  if (candidate.startAtOverride && candidate.endAtOverride && candidate.endAtOverride <= candidate.startAtOverride) {
    res.status(400);
    throw new Error("Candidate end override must be after the start override");
  }
  if (attemptsOverride !== undefined) {
    candidate.attemptsOverride = attemptsOverride === "" ? null : Number(attemptsOverride);
  }

  await candidate.save();

  await logAction({
    adminId: req.admin._id,
    action: "MODIFY_MOCK_TEST_CANDIDATE_OVERRIDE",
    targetCollection: "AllowedCandidate",
    targetId: candidate._id,
    details: {
      before,
      after: {
        startAtOverride: candidate.startAtOverride,
        endAtOverride: candidate.endAtOverride,
        attemptsOverride: candidate.attemptsOverride,
      },
    },
    ipAddress: req.ip,
  });

  res.json(candidate);
});

// @route GET /api/mock-tests/:testId/candidates/:candidateId
const getCandidateDetail = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.testId, res);
  const candidate = await AllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this mock test");
  }

  // Fetch the latest attempt for this candidate
  const reg = await ExamRegistration.findOne({ registrationNumber: candidate.hallTicketNo });
  let attempt = null;
  if (reg) {
    // NOTE: testMongoId is stored as a STRING in the mockattempts collection
    attempt = await MockAttempt.findOne({ studentId: reg.studentId, testMongoId: String(test._id) })
      .sort({ attemptNumber: -1 });
  }

  res.json({
    candidate,
    attempt,
    effective: {
      startAt: candidate.startAtOverride || test.defaultStartAt,
      endAt: candidate.endAtOverride || test.defaultEndAt,
      attempts: candidate.attemptsOverride ?? test.defaultAttempts,
    },
    canManage: isMockTestCreator(test, req.admin),
  });
});

// @route POST /api/mock-tests/:id/publish-results — creator admin only
const publishResults = asyncHandler(async (req, res) => {
  const test = await findMockTestOrThrow(req.params.id, res);
  assertCanManageMockTest(test, req.admin, res);

  if (currentStatus(test) !== "Completed") {
    res.status(400);
    throw new Error("Results can only be published after the mock test is completed");
  }

  const [candidates, questions] = await Promise.all([
    AllowedCandidate.find({ testId: test._id }),
    Question.find({ testId: test._id }),
  ]);

  // Fetch all attempts for this test
  // NOTE: testMongoId is stored as a STRING in the mockattempts collection
  const attempts = await MockAttempt.find({ testMongoId: String(test._id) });

  // Build a map of hallTicketNo -> latest attempt
  const attemptByHallTicket = new Map();
  for (const a of attempts) {
    const reg = await ExamRegistration.findById(a.registrationId);
    if (reg && reg.registrationNumber) {
      const hallTicket = String(reg.registrationNumber).trim();
      const existing = attemptByHallTicket.get(hallTicket);
      if (!existing || (a.attemptNumber || 1) > (existing.attemptNumber || 0)) {
        attemptByHallTicket.set(hallTicket, a);
      }
    }
  }

  // Fetch student info for names and emails
  const regs = await ExamRegistration.find({ registrationNumber: { $in: candidates.map((c) => c.hallTicketNo) } });
  const studentIds = regs.map((r) => r.studentId).filter(Boolean);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentById = new Map(students.map((s) => [String(s._id), s]));
  const regByHallTicket = new Map(regs.map((r) => [String(r.registrationNumber).trim(), r]));

  const summary = { delivered: 0, skipped: 0, failed: 0, missingEmail: 0 };

  for (const candidate of candidates) {
    if (candidate.resultPublishedAt) {
      summary.skipped += 1;
      continue;
    }

    const reg = regByHallTicket.get(candidate.hallTicketNo);
    const student = reg ? studentById.get(String(reg.studentId)) : null;
    const recipient = candidate.resultEmail || student?.email || student?.emailId;
    if (!recipient) {
      candidate.resultDeliveryError = "No registered email address found";
      await candidate.save();
      summary.missingEmail += 1;
      continue;
    }

    const attempt = attemptByHallTicket.get(candidate.hallTicketNo) || null;
    const studentName = student?.name || student?.fullName || candidate.hallTicketNo;

    try {
      const pdf = await makeResponsePdf({ test, candidate, questions, attempt });
      await sendResultEmail({ recipient, test, candidate, pdf, attempt, studentName });
      candidate.resultPublishedAt = new Date();
      candidate.resultEmail = recipient;
      candidate.resultDeliveryError = "";
      await candidate.save();
      summary.delivered += 1;
    } catch (error) {
      candidate.resultDeliveryError = error.message;
      await candidate.save();
      summary.failed += 1;
    }
  }

  if (summary.delivered > 0) {
    test.resultsPublishedAt = new Date();
    test.resultsPublishedBy = req.admin._id;
    await test.save();
  }

  await logAction({
    adminId: req.admin._id,
    action: "PUBLISH_MOCK_TEST_RESULTS",
    targetCollection: "Test",
    targetId: test._id,
    details: summary,
    ipAddress: req.ip,
  });

  res.json({ message: "Result publication finished", summary });
});

module.exports = {
  eligibleStudentCount,
  createMockTest,
  listMockTests,
  getMockTest,
  deleteMockTest,
  modifyMockTestDefaults,
  listCandidates,
  addCandidate,
  updateCandidate,
  getCandidateDetail,
  publishResults,
};