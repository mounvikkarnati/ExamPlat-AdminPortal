const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const FinalExam = require("../models/FinalExam");
const FinalQuestion = require("../models/FinalQuestion");
const FinalAllowedCandidate = require("../models/FinalAllowedCandidate");
const FinalAttempt = require("../models/FinalAttempt");
const ExamRegistration = require("../models/ExamRegistration");
const Student = require("../models/Student");
const Admin = require("../models/Admin");
const { parseQuestionFile, parseCandidateFile } = require("../utils/parseUploads");
const { generateFinalExamId, logAction } = require("../utils/helpers");
const { sendResultReleaseEmail } = require("../utils/resultDelivery");
const { attemptBrowser } = require("../utils/browserDetection");

// The student portal shares this MongoDB and may create a stale unique index
// { candidateId: 1, examId: 1 } on the finalallowedcandidates collection.
// That index has no corresponding fields in this app's FinalAllowedCandidate
// schema (which uses testId + hallTicketNo), so documents with candidateId: null
// and examId: null collide on the 2nd insert with E11000. Drop it right before
// any insert/create as a safety net (mirrors the dropStaleQuestionIndex pattern).
const dropStaleAllowedCandidateIndex = async () => {
  try {
    const db = mongoose.connection.db;
    const col = db.collection("finalallowedcandidates");
    const indexes = await col.indexes();
    const stale = indexes.filter(
      (idx) => idx.key.candidateId !== undefined || idx.key.examId !== undefined
    );
    for (const idx of stale) {
      await col.dropIndex(idx.name);
    }
  } catch (err) {
    // Non-fatal: index may already be gone or collection may not exist yet.
  }
};

const MAX_ATTEMPTS = 20;
const EXAM_CATEGORIES = ["JEE", "NEET"];

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
const validAttemptCount = (value) =>
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= MAX_ATTEMPTS;

// Exam duration arrives as two separate fields: hours on a 24-hour clock (0-23)
// and minutes (0-59). Hours may be 0 for exams shorter than an hour — only the
// combined total must be greater than zero. Returns { hours, minutes } or
// { message } when invalid.
const parseDurationInput = (hoursRaw, minutesRaw) => {
  // Blank / undefined fields count as 0, so exams under an hour can use just minutes.
  const blank = (v) => v === undefined || v === null || String(v).trim() === "";
  const hours = Number(blank(hoursRaw) ? 0 : hoursRaw);
  const minutes = Number(blank(minutesRaw) ? 0 : minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return { message: "Exam duration must be whole numbers in the separate hour and minute fields" };
  }
  if (hours < 0 || hours > 23) {
    return { message: "Duration hours must be between 0 and 23" };
  }
  if (minutes < 0 || minutes > 59) {
    return { message: "Duration minutes must be between 0 and 59" };
  }
  if (hours + minutes === 0) {
    return { message: "Exam duration must be greater than zero — for exams under an hour enter 0 hours plus minutes" };
  }
  return { hours, minutes };
};

const currentStatus = (test) => {
  const now = Date.now();
  if (new Date(test.defaultEndAt).getTime() < now) return "Completed";
  if (new Date(test.defaultStartAt).getTime() <= now) return "Live";
  return "Scheduled";
};

const withCurrentStatus = (test) => ({ ...test.toObject(), status: currentStatus(test) });

const findExamOrThrow = async (id, res) => {
  const test = await FinalExam.findById(id).populate("createdBy", "name role");
  if (!test) {
    res.status(404);
    throw new Error("Examination not found");
  }
  return test;
};

// Only Super Admins can create, delete, and publish results for examinations.
const isSuperAdmin = (admin) => !!admin && admin.role === "superadmin";

// A regular admin has modify access when the exam was created with "allow all admins"
// enabled OR they are explicitly listed in allowedAdmins. The Super Admin always has access.
const canManageExam = (test, admin) => {
  if (!admin || !test) return false;
  if (isSuperAdmin(admin)) return true;
  const creatorId = String(test.createdBy?._id || test.createdBy || "");
  if (creatorId && creatorId === String(admin._id)) return true;
  if (admin.role === "admin") {
    if (test.allowAllAdmins) return true;
    const granted = (test.allowedAdmins || []).map((a) => String(a?._id || a));
    return granted.includes(String(admin._id));
  }
  return false;
};

const assertCanManageExam = (test, admin, res) => {
  if (!canManageExam(test, admin)) {
    res.status(403);
    throw new Error("You do not have modify access to this examination");
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

// allowedAdmins arrives as a JSON-encoded string (multipart form) or a plain array.
const parseAllowedAdmins = (raw) => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
};

// Only keep ids that point at existing, active, non-super admin accounts.
const resolveAllowedAdmins = async (rawIds) => {
  const unique = new Set();
  for (const rawId of rawIds) {
    if (!mongoose.isValidObjectId(rawId)) continue;
    unique.add(String(rawId));
  }
  if (unique.size === 0) return [];
  const admins = await Admin.find({ _id: { $in: [...unique] }, active: true, role: "admin" }).select("_id");
  return admins.map((a) => a._id);
};

// @route GET /api/tests/eligible-count?examCategory=JEE
const eligibleStudentCount = asyncHandler(async (req, res) => {
  const { examCategory } = req.query;
  if (!EXAM_CATEGORIES.includes(examCategory)) {
    res.status(400);
    throw new Error("examCategory must be JEE or NEET");
  }
  const candidates = await fetchCandidatesFromExamRegistrations(examCategory);
  res.json({ examCategory, count: candidates.length });
});

// @route POST /api/tests — Super Admin only
const createExam = asyncHandler(async (req, res) => {
  if (!isSuperAdmin(req.admin)) {
    res.status(403);
    throw new Error("Forbidden: Super Admin access required");
  }

  const { title, subject, startAt, endAt, defaultAttempts, durationHours, durationMinutes, examCategory, selectAllStudents } = req.body;
  const questionFile = req.files?.questionFile?.[0];
  const candidateFile = req.files?.candidateFile?.[0];
  const enrollAll = selectAllStudents === "true" || selectAllStudents === true;
  const allowAllAdmins = req.body.allowAllAdmins === "true" || req.body.allowAllAdmins === true;

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

  // Hours of 0 are valid for exams shorter than an hour; blank fields count as
  // 0. Only a combined total of 0 is rejected by parseDurationInput.
  const parsedDuration = parseDurationInput(durationHours, durationMinutes);
  if (parsedDuration.message) {
    res.status(400);
    throw new Error(parsedDuration.message);
  }

  const allowedAdmins = await resolveAllowedAdmins(parseAllowedAdmins(req.body.allowedAdmins));

  const { questions, errors: questionErrors } = parseQuestionFile(questionFile, true);
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

  let finalExamId;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateId = generateFinalExamId();
    if (!(await FinalExam.exists({ finalExamId: candidateId }))) {
      finalExamId = candidateId;
      break;
    }
  }
  if (!finalExamId) {
    res.status(503);
    throw new Error("Could not allocate a unique examination ID. Please try again.");
  }

  const exam = await FinalExam.create({
    finalExamId,
    title,
    subject: subject || "",
    defaultStartAt: startDate,
    defaultEndAt: endDate,
    defaultAttempts: Number(defaultAttempts ?? 1),
    duration: { hours: parsedDuration.hours, minutes: parsedDuration.minutes },
    status: "Scheduled",
    candidateCount: candidates.length,
    examCategory,
    selectAllStudents: enrollAll,
    allowAllAdmins,
    allowedAdmins,
    createdBy: req.admin._id,
  });

  await exam.populate("createdBy", "name role");

    await FinalQuestion.insertMany(questions.map((q) => ({ ...q, testId: exam._id })));

  await dropStaleAllowedCandidateIndex();
  await FinalAllowedCandidate.insertMany(
    candidates.map((c) => ({
      testId: exam._id,
      hallTicketNo: c.hallTicketNo,
      dob: c.dob,
      startAtOverride: null,
      endAtOverride: null,
      attemptsOverride: null,
    }))
  );

  await logAction({
    adminId: req.admin._id,
    action: "CREATE_FINAL_EXAM",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: {
      finalExamId,
      examCategory,
      duration: { hours: parsedDuration.hours, minutes: parsedDuration.minutes },
      selectAllStudents: enrollAll,
      allowAllAdmins,
      allowedAdmins: allowedAdmins.map((a) => String(a)),
      questionCount: questions.length,
      candidateCount: candidates.length,
    },
    ipAddress: req.ip,
  });

  res.status(201).json({
    test: withCurrentStatus(exam),
    questionCount: questions.length,
    candidateCount: candidates.length,
    canManage: true,
  });
});

// @route GET /api/tests
const listExams = asyncHandler(async (req, res) => {
  const exams = await FinalExam.find()
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });
  res.json(exams.map((exam) => ({ ...withCurrentStatus(exam), canManage: canManageExam(exam, req.admin) })));
});

// @route GET /api/tests/:id
const getExam = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  const questionCount = await FinalQuestion.countDocuments({ testId: exam._id });
  res.json({
    test: withCurrentStatus(exam),
    questionCount,
    canManage: canManageExam(exam, req.admin),
    canPublish: isSuperAdmin(req.admin),
    canDelete: isSuperAdmin(req.admin),
    canEditManagers: isSuperAdmin(req.admin),
  });
});

// @route DELETE /api/tests/:id — Super Admin only
const deleteExam = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  if (!isSuperAdmin(req.admin)) {
    res.status(403);
    throw new Error("Forbidden: Super Admin access required");
  }

  await Promise.all([
    FinalQuestion.deleteMany({ testId: exam._id }),
    FinalAllowedCandidate.deleteMany({ testId: exam._id }),
  ]);

  await FinalExam.findByIdAndDelete(exam._id);

  await logAction({
    adminId: req.admin._id,
    action: "DELETE_FINAL_EXAM",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: { title: exam.title, finalExamId: exam.finalExamId },
    ipAddress: req.ip,
  });

  res.json({ message: "Examination deleted successfully", finalExamId: exam.finalExamId });
});

// @route PUT /api/tests/:id — anyone with modify access to the exam
const modifyExamDefaults = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  assertCanManageExam(exam, req.admin, res);

  const { startAt, endAt, startTime, endTime, defaultAttempts, durationHours, durationMinutes } = req.body;

  const before = {
    defaultStartAt: exam.defaultStartAt,
    defaultEndAt: exam.defaultEndAt,
    defaultAttempts: exam.defaultAttempts,
    duration: { hours: exam.duration?.hours, minutes: exam.duration?.minutes },
  };

  if (startAt) {
    const parsed = new Date(startAt);
    if (!isValidDate(parsed)) {
      res.status(400);
      throw new Error("Start date and time must be valid");
    }
    exam.defaultStartAt = parsed;
  } else if (startTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      res.status(400);
      throw new Error("Start time must be in HH:mm format");
    }
    const [h, m] = startTime.split(":").map(Number);
    const next = new Date(exam.defaultStartAt);
    next.setHours(h, m, 0, 0);
    exam.defaultStartAt = next;
  }

  if (endAt) {
    const parsed = new Date(endAt);
    if (!isValidDate(parsed)) {
      res.status(400);
      throw new Error("End date and time must be valid");
    }
    exam.defaultEndAt = parsed;
  } else if (endTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      res.status(400);
      throw new Error("End time must be in HH:mm format");
    }
    const [h, m] = endTime.split(":").map(Number);
    const next = new Date(exam.defaultEndAt);
    next.setHours(h, m, 0, 0);
    exam.defaultEndAt = next;
  }

  if (exam.defaultEndAt <= exam.defaultStartAt) {
    res.status(400);
    throw new Error("End date and time must be after the start date and time");
  }

  if (defaultAttempts !== undefined) {
    if (!validAttemptCount(defaultAttempts)) {
      res.status(400);
      throw new Error(`Default attempts must be a whole number from 1 to ${MAX_ATTEMPTS}`);
    }
    exam.defaultAttempts = Number(defaultAttempts);
  }

  // Optional duration update — hours (24-hour clock) and minutes are separate fields.
  // If only one of the two is sent, the other keeps its current value.
  const hasHoursInput = durationHours !== undefined && String(durationHours).trim() !== "";
  const hasMinutesInput = durationMinutes !== undefined && String(durationMinutes).trim() !== "";
  if (hasHoursInput || hasMinutesInput) {
    const parsedDuration = parseDurationInput(
      hasHoursInput ? durationHours : (exam.duration?.hours ?? 0),
      hasMinutesInput ? durationMinutes : (exam.duration?.minutes ?? 0)
    );
    if (parsedDuration.message) {
      res.status(400);
      throw new Error(parsedDuration.message);
    }
    exam.duration = { hours: parsedDuration.hours, minutes: parsedDuration.minutes };
  }

  await exam.save();

  await logAction({
    adminId: req.admin._id,
    action: "MODIFY_FINAL_EXAM_DEFAULTS",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: {
      before,
      after: {
        defaultStartAt: exam.defaultStartAt,
        defaultEndAt: exam.defaultEndAt,
        defaultAttempts: exam.defaultAttempts,
        duration: { hours: exam.duration?.hours, minutes: exam.duration?.minutes },
      },
    },
    ipAddress: req.ip,
  });

  res.json(withCurrentStatus(exam));
});

// @route PUT /api/tests/:id/managers — Super Admin only: choose which admins can modify
const modifyExamManagers = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  if (!isSuperAdmin(req.admin)) {
    res.status(403);
    throw new Error("Forbidden: Super Admin access required");
  }

  const allowAllAdmins = req.body.allowAllAdmins === true || req.body.allowAllAdmins === "true";
  const allowedAdmins = await resolveAllowedAdmins(parseAllowedAdmins(req.body.allowedAdmins));

  const before = {
    allowAllAdmins: exam.allowAllAdmins,
    allowedAdmins: exam.allowedAdmins,
  };

  exam.allowAllAdmins = allowAllAdmins;
  exam.allowedAdmins = allowedAdmins;
  await exam.save();

  await logAction({
    adminId: req.admin._id,
    action: "MODIFY_FINAL_EXAM_MANAGERS",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: {
      before,
      after: { allowAllAdmins, allowedAdmins: allowedAdmins.map((a) => String(a)) },
    },
    ipAddress: req.ip,
  });

  res.json({ ...withCurrentStatus(exam), canManage: canManageExam(exam, req.admin) });
});

// @route GET /api/tests/:id/candidates
// Fetches scores from the finalattempts collection and joins them by hall ticket.
const listCandidates = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 25 } = req.query;
  const exam = await findExamOrThrow(req.params.id, res);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const filter = { testId: req.params.id };
  if (search) {
    filter.hallTicketNo = { $regex: search, $options: "i" };
  }

  const skip = (safePage - 1) * safeLimit;
  const [candidates, total] = await Promise.all([
    FinalAllowedCandidate.find(filter).sort({ hallTicketNo: 1 }).skip(skip).limit(safeLimit),
    FinalAllowedCandidate.countDocuments(filter),
  ]);

  // Fetch scores from finalattempts for this exam.
  // NOTE: testMongoId is stored as a STRING in the finalattempts collection.
  // The Exam Portal stores the candidate link on `registrationId` (= the
  // finalallowedcandidates _id), so join attempts directly to candidates by
  // that _id — the OLD studentId/reg join was broken and never surfaced data.
  const attempts = await FinalAttempt.find({ testMongoId: String(exam._id) });
  const bestAttemptByCandidateId = new Map();
  for (const a of attempts) {
    const candidateId = a.registrationId ? String(a.registrationId) : String(a.studentId || '');
    if (!candidateId) continue;
    const existing = bestAttemptByCandidateId.get(candidateId);
    if (!existing || (a.attemptNumber || 1) > (existing.attemptNumber || 0)) {
      bestAttemptByCandidateId.set(candidateId, a);
    }
  }

  const enriched = candidates.map((c) => {
    const obj = c.toObject();
    const attempt = bestAttemptByCandidateId.get(String(c._id));
    if (attempt) {
      obj.score = attempt.score;
      obj.totalMarks = attempt.totalMarks;
      obj.attemptNumber = attempt.attemptNumber;
      obj.percentage = attempt.percentage;
      obj.attemptStatus = attempt.status;
      obj.browser = attemptBrowser(attempt);
    }
    return obj;
  });

  res.json({ candidates: enriched, total, page: safePage, limit: safeLimit, canManage: canManageExam(exam, req.admin) });
});

// @route POST /api/tests/:id/candidates — anyone with modify access to the exam
const addCandidate = asyncHandler(async (req, res) => {
  const { hallTicketNo, dob } = req.body;
  if (!hallTicketNo) {
    res.status(400);
    throw new Error("Hall Ticket No. is required");
  }

  const exam = await findExamOrThrow(req.params.id, res);
  assertCanManageExam(exam, req.admin, res);

  const normalizedTicket = hallTicketNo.trim();
  const exists = await FinalAllowedCandidate.findOne({ testId: req.params.id, hallTicketNo: normalizedTicket });
  if (exists) {
    res.status(409);
    throw new Error("This Hall Ticket No. is already on the allow-list for this examination");
  }

    await dropStaleAllowedCandidateIndex();
  const candidate = await FinalAllowedCandidate.create({
    testId: req.params.id,
    hallTicketNo: normalizedTicket,
    dob: dob ? new Date(dob) : null,
  });

  await FinalExam.findByIdAndUpdate(req.params.id, { $inc: { candidateCount: 1 } });

  await logAction({
    adminId: req.admin._id,
    action: "ADD_FINAL_EXAM_CANDIDATE",
    targetCollection: "FinalAllowedCandidate",
    targetId: candidate._id,
    details: { hallTicketNo: normalizedTicket },
    ipAddress: req.ip,
  });

  res.status(201).json(candidate);
});

// @route PUT /api/tests/:testId/candidates/:candidateId — anyone with modify access to the exam
const updateCandidate = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.testId, res);
  assertCanManageExam(exam, req.admin, res);

  const candidate = await FinalAllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this examination");
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
    action: "MODIFY_FINAL_EXAM_CANDIDATE_OVERRIDE",
    targetCollection: "FinalAllowedCandidate",
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

// @route GET /api/tests/:testId/candidates/:candidateId
const getCandidateDetail = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.testId, res);
  const candidate = await FinalAllowedCandidate.findOne({
    _id: req.params.candidateId,
    testId: req.params.testId,
  });
  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found on this examination");
  }

  // Fetch the latest attempt for this candidate from finalattempts.
  // The Exam Portal stores the connection on `registrationId` (= this
  // candidate's _id), NOT on studentId (which it sets to a hall-ticket string).
  // Look it up by registrationId first so the attempt — and its `browser` field —
  // is actually found. Fall back to the legacy studentId-based join for rows
  // written by older portal versions.
  let attempt = null;
  // NOTE: testMongoId is stored as a STRING in the finalattempts collection
  attempt = await FinalAttempt.findOne({ registrationId: candidate._id, testMongoId: String(exam._id) })
    .sort({ attemptNumber: -1 });
  if (!attempt) {
    const reg = await ExamRegistration.findOne({ registrationNumber: candidate.hallTicketNo });
    if (reg) {
      attempt = await FinalAttempt.findOne({ studentId: reg.studentId, testMongoId: String(exam._id) })
        .sort({ attemptNumber: -1 });
    }
  }

  res.json({
    candidate,
    attempt,
    browser: attemptBrowser(attempt),
    effective: {
      startAt: candidate.startAtOverride || exam.defaultStartAt,
      endAt: candidate.endAtOverride || exam.defaultEndAt,
      attempts: candidate.attemptsOverride ?? exam.defaultAttempts,
    },
    canManage: canManageExam(exam, req.admin),
  });
});

// @route PATCH /api/tests/:id/results-published — Super Admin only
const toggleResultsPublished = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  if (!isSuperAdmin(req.admin)) {
    res.status(403);
    throw new Error("Forbidden: Super Admin access required");
  }

  const published = !!req.body.published;
  exam.resultsPublished = published;
  exam.resultsPublishedAt = new Date();
  exam.resultsPublishedBy = req.admin._id;
  await exam.save();

  await logAction({
    adminId: req.admin._id,
    action: published ? "ENABLE_FINAL_EXAM_RESULTS" : "DISABLE_FINAL_EXAM_RESULTS",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: { resultsPublished: published },
    ipAddress: req.ip,
  });

  res.json({
    message: published ? "Results marked as published" : "Results marked as unpublished",
    test: withCurrentStatus(exam),
    resultsPublished: exam.resultsPublished,
    resultsPublishedAt: exam.resultsPublishedAt,
  });
});

// @route POST /api/tests/:id/send-result-notification — Super Admin only
const sendResultNotification = asyncHandler(async (req, res) => {
  const exam = await findExamOrThrow(req.params.id, res);
  if (!isSuperAdmin(req.admin)) {
    res.status(403);
    throw new Error("Forbidden: Super Admin access required");
  }

  if (!exam.resultsPublished) {
    res.status(400);
    throw new Error("Results must be published before sending notifications");
  }

  const candidates = await FinalAllowedCandidate.find({ testId: exam._id });

  const regs = await ExamRegistration.find({
    registrationNumber: { $in: candidates.map((c) => c.hallTicketNo) },
  });
  const studentIds = regs.map((r) => r.studentId).filter(Boolean);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentById = new Map(students.map((s) => [String(s._id), s]));
  const regByHallTicket = new Map(
    regs.map((r) => [String(r.registrationNumber).trim(), r])
  );

  const summary = { sent: 0, failed: 0, missingEmail: 0, total: candidates.length };

  for (const candidate of candidates) {
    const reg = regByHallTicket.get(candidate.hallTicketNo);
    const student = reg ? studentById.get(String(reg.studentId)) : null;
    const recipient = candidate.resultEmail || student?.email || student?.emailId;
    if (!recipient) {
      summary.missingEmail += 1;
      continue;
    }

    const studentName = student?.name || student?.fullName || candidate.hallTicketNo;
    try {
      await sendResultReleaseEmail({ recipient, test: exam, studentName });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
    }
  }

  await logAction({
    adminId: req.admin._id,
    action: "SEND_FINAL_EXAM_RESULT_NOTIFICATION",
    targetCollection: "FinalExam",
    targetId: exam._id,
    details: summary,
    ipAddress: req.ip,
  });

  res.json({ message: "Result notification finished", summary });
});

module.exports = {
  eligibleStudentCount,
  createExam,
  listExams,
  getExam,
  deleteExam,
  modifyExamDefaults,
  modifyExamManagers,
  listCandidates,
  addCandidate,
  updateCandidate,
  getCandidateDetail,
  toggleResultsPublished,
  sendResultNotification,
};