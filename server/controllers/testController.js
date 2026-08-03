const asyncHandler = require("express-async-handler");
const Test = require("../models/Test");
const Question = require("../models/Question");
const AllowedCandidate = require("../models/AllowedCandidate");
const { parseQuestionFile, parseCandidateFile } = require("../utils/parseUploads");
const { generateTestId, logAction } = require("../utils/helpers");
const Student = require("../models/Student");
const { makeResponsePdf, sendResultEmail } = require("../utils/resultDelivery");

const MAX_ATTEMPTS = 20;

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

const findTestOrThrow = async (id, res) => {
  const test = await Test.findById(id).populate("createdBy", "name role");
  if (!test) {
    res.status(404);
    throw new Error("Test not found");
  }
  return test;
};

// @route POST /api/tests   (Section 4 - Create Test: question upload + schedule + candidate list, all required)
const createTest = asyncHandler(async (req, res) => {
  const { title, subject, startAt, endAt, defaultAttempts } = req.body;
  const questionFile = req.files?.questionFile?.[0];
  const candidateFile = req.files?.candidateFile?.[0];

  if (!title || !startAt || !endAt || !questionFile || !candidateFile) {
    res.status(400);
    throw new Error(
      "Title, schedule (start/end), a question file, and a candidate allow-list file are all required"
    );
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

  // FR-A-04: validate question upload with row-level errors before the test is created
  const { questions, errors: questionErrors } = parseQuestionFile(questionFile);
  const { candidates, errors: candidateErrors } = parseCandidateFile(candidateFile);

  if (questionErrors.length > 0 || questions.length === 0) {
    return res.status(422).json({
      message: "Question upload failed validation",
      questionErrors,
      candidateErrors,
    });
  }
  if (candidateErrors.length > 0 || candidates.length === 0) {
    return res.status(422).json({
      message: "Candidate upload failed validation",
      questionErrors,
      candidateErrors,
    });
  }

  let testId;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateId = generateTestId();
    // The human-readable ID is not the database identifier, so guard its unique index explicitly.
    if (!(await Test.exists({ testId: candidateId }))) {
      testId = candidateId;
      break;
    }
  }
  if (!testId) {
    res.status(503);
    throw new Error("Could not allocate a unique test ID. Please try again.");
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
    createdBy: req.admin._id,
  });

  await test.populate("createdBy", "name role");

  await Question.insertMany(questions.map((q) => ({ ...q, testId: test._id })));

  await AllowedCandidate.insertMany(
    candidates.map((c) => ({
      testId: test._id,
      hallTicketNo: c.hallTicketNo,
      dob: c.dob,
      // Section 4.3: each starts with the test's default attempt count and default schedule (i.e. no override)
      startAtOverride: null,
      endAtOverride: null,
      attemptsOverride: null,
    }))
  );

  await logAction({
    adminId: req.admin._id,
    action: "CREATE_TEST",
    targetCollection: "Test",
    targetId: test._id,
    details: { testId, questionCount: questions.length, candidateCount: candidates.length },
    ipAddress: req.ip,
  });

  res.status(201).json({ test: withCurrentStatus(test), questionCount: questions.length, candidateCount: candidates.length });
});

// @route GET /api/tests   (Section 5.1 - Test List — scheduled exams only)
const listTests = asyncHandler(async (req, res) => {
  const tests = await Test.find({ testType: { $ne: "mock" } })
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });
  res.json(tests.map(withCurrentStatus));
});

// @route GET /api/tests/:id   (Test detail page)
const getTest = asyncHandler(async (req, res) => {
  const test = await findTestOrThrow(req.params.id, res);
  const questionCount = await Question.countDocuments({ testId: test._id });
  res.json({ test: withCurrentStatus(test), questionCount });
});

// @route DELETE /api/tests/:id   (Super Admin only - remove the full exam record and its related data)
const deleteTest = asyncHandler(async (req, res) => {
  const test = await findTestOrThrow(req.params.id, res);

  await Promise.all([
    Question.deleteMany({ testId: test._id }),
    AllowedCandidate.deleteMany({ testId: test._id }),
  ]);

  await Test.findByIdAndDelete(test._id);

  await logAction({
    adminId: req.admin._id,
    action: "DELETE_TEST",
    targetCollection: "Test",
    targetId: test._id,
    details: { title: test.title, testId: test.testId },
    ipAddress: req.ip,
  });

  res.json({ message: "Test deleted successfully", testId: test.testId });
});

// @route PUT /api/tests/:id   (Section 5.2 - edit start/end date AND time)
const modifyTestDefaults = asyncHandler(async (req, res) => {
  const test = await findTestOrThrow(req.params.id, res);

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
    action: "MODIFY_TEST_DEFAULTS",
    targetCollection: "Test",
    targetId: test._id,
    details: { before, after: { defaultStartAt: test.defaultStartAt, defaultEndAt: test.defaultEndAt, defaultAttempts: test.defaultAttempts } },
    ipAddress: req.ip,
  });

  res.json(withCurrentStatus(test));
});

// @route GET /api/tests/:id/candidates   (Section 5.2 - candidate list + Section 5.4 search, server-side paginated)
const listCandidates = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 25 } = req.query;
  await findTestOrThrow(req.params.id, res);
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

  res.json({ candidates, total, page: safePage, limit: safeLimit });
});

// @route POST /api/tests/:id/candidates   (Section 5.2 - add a new Hall Ticket Number)
const addCandidate = asyncHandler(async (req, res) => {
  const { hallTicketNo, dob } = req.body;
  if (!hallTicketNo) {
    res.status(400);
    throw new Error("Hall Ticket No. is required");
  }

  await findTestOrThrow(req.params.id, res);
  const normalizedTicket = hallTicketNo.trim();
  const exists = await AllowedCandidate.findOne({ testId: req.params.id, hallTicketNo: normalizedTicket });
  if (exists) {
    res.status(409);
    throw new Error("This Hall Ticket No. is already on the allow-list for this test");
  }

  // Inherits the test's current default schedule/attempts (Section 5.2) - no overrides set
  const candidate = await AllowedCandidate.create({
    testId: req.params.id,
    hallTicketNo: normalizedTicket,
    dob: dob ? new Date(dob) : null,
  });

  await Test.findByIdAndUpdate(req.params.id, { $inc: { candidateCount: 1 } });

  await logAction({
    adminId: req.admin._id,
    action: "ADD_CANDIDATE",
    targetCollection: "AllowedCandidate",
    targetId: candidate._id,
    details: { hallTicketNo: normalizedTicket },
    ipAddress: req.ip,
  });

  res.status(201).json(candidate);
});

// @route PUT /api/tests/:testId/candidates/:candidateId
// Section 5.2/5.3 - per-candidate override of time/attempts; does not touch the test-wide default (FR-A-07)
const updateCandidate = asyncHandler(async (req, res) => {
  const candidate = await AllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this test");
  }

  const { startAtOverride, endAtOverride, attemptsOverride } = req.body;
  const before = {
    startAtOverride: candidate.startAtOverride,
    endAtOverride: candidate.endAtOverride,
    attemptsOverride: candidate.attemptsOverride,
  };

  // FR-A-08: raising attempts after exhaustion resumes the existing attempt rather than resetting it -
  // this is enforced jointly with the Student Portal; here we simply persist the new limit.
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
  if (attemptsOverride !== undefined) candidate.attemptsOverride = attemptsOverride === "" ? null : Number(attemptsOverride);

  await candidate.save();

  await logAction({
    adminId: req.admin._id,
    action: "MODIFY_CANDIDATE_OVERRIDE",
    targetCollection: "AllowedCandidate",
    targetId: candidate._id,
    details: { before, after: { startAtOverride: candidate.startAtOverride, endAtOverride: candidate.endAtOverride, attemptsOverride: candidate.attemptsOverride } },
    ipAddress: req.ip,
  });

  res.json(candidate);
});

// @route GET /api/tests/:testId/candidates/:candidateId   (Section 6 - Candidate Detail and Result Oversight)
const getCandidateDetail = asyncHandler(async (req, res) => {
  const candidate = await AllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this test");
  }
  const test = await findTestOrThrow(req.params.testId, res);

  res.json({
    candidate,
    effective: {
      startAt: candidate.startAtOverride || test.defaultStartAt,
      endAt: candidate.endAtOverride || test.defaultEndAt,
      attempts: candidate.attemptsOverride ?? test.defaultAttempts,
    },
  });
});

// @route POST /api/tests/:id/publish-results - emails each candidate once the assessment is complete.
const publishResults = asyncHandler(async (req, res) => {
  const test = await findTestOrThrow(req.params.id, res);
  if (currentStatus(test) !== "Completed") {
    res.status(400);
    throw new Error("Results can only be published after the examination is completed");
  }
  const [candidates, questions] = await Promise.all([AllowedCandidate.find({ testId: test._id }), Question.find({ testId: test._id })]);
  const students = await Student.find({ $or: [{ hallTicketNo: { $in: candidates.map((candidate) => candidate.hallTicketNo) } }, { hallTicket: { $in: candidates.map((candidate) => candidate.hallTicketNo) } }] });
  const emailsByHallTicket = new Map(students.map((student) => [student.hallTicketNo || student.hallTicket, student.email || student.emailId]));
  const namesByHallTicket = new Map(students.map((student) => [student.hallTicketNo || student.hallTicket, student.name || student.fullName || student.hallTicketNo || student.hallTicket]));
  const summary = { delivered: 0, skipped: 0, failed: 0, missingEmail: 0 };
  for (const candidate of candidates) {
    if (candidate.resultPublishedAt) { summary.skipped += 1; continue; }
    const recipient = candidate.resultEmail || emailsByHallTicket.get(candidate.hallTicketNo);
    if (!recipient) { candidate.resultDeliveryError = "No registered email address found"; await candidate.save(); summary.missingEmail += 1; continue; }
    const studentName = namesByHallTicket.get(candidate.hallTicketNo) || candidate.hallTicketNo;
    try {
      const pdf = await makeResponsePdf({ test, candidate, questions, attempt: null });
      await sendResultEmail({ recipient, test, candidate, pdf, attempt: null, studentName });
      candidate.resultPublishedAt = new Date(); candidate.resultEmail = recipient; candidate.resultDeliveryError = ""; await candidate.save(); summary.delivered += 1;
    } catch (error) { candidate.resultDeliveryError = error.message; await candidate.save(); summary.failed += 1; }
  }
  if (summary.delivered > 0) { test.resultsPublishedAt = new Date(); test.resultsPublishedBy = req.admin._id; await test.save(); }
  await logAction({ adminId: req.admin._id, action: "PUBLISH_RESULTS", targetCollection: "Test", targetId: test._id, details: summary, ipAddress: req.ip });
  res.json({ message: "Result publication finished", summary });
});

module.exports = {
  createTest,
  listTests,
  getTest,
  deleteTest,
  modifyTestDefaults,
  listCandidates,
  addCandidate,
  updateCandidate,
  getCandidateDetail,
  publishResults,
};
