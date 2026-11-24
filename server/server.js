require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const examRoutes = require("./routes/examRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const studentRoutes = require("./routes/studentRoutes");

connectDB();

// ---------------------------------------------------------------------------
// Startup cleanup: drop the stale unique index "testId_1_questionId_1" from
// the questions collection if it exists.
//
// The student portal shares this same MongoDB database and its Question model
// defines a unique compound index { testId: 1, questionId: 1 }. That index is
// stale for this app because the current Question schema has no questionId
// field — every document stores questionId: null, so the unique index rejects
// the 2nd+ question for the same test with E11000.
//
// The student portal may recreate this index whenever it starts (Mongoose
// autoIndex). This cleanup runs on every admin server boot to permanently
// remove it, so test creation never fails with a duplicate key error.
// ---------------------------------------------------------------------------
const dropStaleQuestionIndex = async () => {
  try {
    const db = mongoose.connection.db;
    const col = db.collection("questions");
    const indexes = await col.indexes();
    const stale = indexes.filter((idx) => idx.key.questionId !== undefined);
    for (const idx of stale) {
      console.log(`[startup] Dropping stale index "${idx.name}" from questions collection`);
      await col.dropIndex(idx.name);
      console.log(`[startup] Dropped "${idx.name}"`);
    }
  } catch (err) {
    // Non-fatal: if the index is already gone or the collection doesn't exist, just log it.
    console.error("[startup] Could not clean stale question index:", err.message);
  }
};

// ---------------------------------------------------------------------------
// Startup cleanup: drop stale unique indexes from the shared allow-list
// collections (finalallowedcandidates, allowedcandidates).
//
// The student portal shares this same MongoDB database and uses older
// field names (candidateId, examId) for its candidate model. Those fields
// do not exist on the admin portal's FinalAllowedCandidate / AllowedCandidate
// schemas (which use testId + hallTicketNo), so every document is indexed
// as { candidateId: null, examId: null } — and the stale unique compound
// index rejects the 2nd+ candidate with E11000.
//
// Same pattern as dropStaleQuestionIndex above.
// ---------------------------------------------------------------------------
const dropStaleAllowedCandidateIndexes = async () => {
  const collections = ["finalallowedcandidates", "allowedcandidates"];
  for (const collectionName of collections) {
    try {
      const db = mongoose.connection.db;
      const col = db.collection(collectionName);
      const indexes = await col.indexes();
      const stale = indexes.filter(
        (idx) => idx.key.candidateId !== undefined || idx.key.examId !== undefined
      );
      for (const idx of stale) {
        console.log(`[startup] Dropping stale index "${idx.name}" from ${collectionName} collection`);
        await col.dropIndex(idx.name);
        console.log(`[startup] Dropped "${idx.name}" from ${collectionName}`);
      }

      // With autoIndex: false on the models, Mongoose won't create the correct
      // indexes — ensure they exist here by creating them idempotently.
      // The unique index may fail if legacy documents have null testId/hallTicketNo;
      // that is non-fatal because the application enforces uniqueness in code.
      try {
        await col.createIndex({ testId: 1, hallTicketNo: 1 }, { unique: true });
        console.log(`[startup] Ensured unique index on { testId, hallTicketNo } in ${collectionName}`);
      } catch (idxErr) {
        console.error(`[startup] Could not create unique index on ${collectionName}:`, idxErr.message);
      }

      try {
        await col.createIndex({ testId: 1, hallTicketNo: "text" });
        console.log(`[startup] Ensured text index on { testId, hallTicketNo } in ${collectionName}`);
      } catch (idxErr) {
        console.error(`[startup] Could not create text index on ${collectionName}:`, idxErr.message);
      }
    } catch (err) {
      // Non-fatal: if the collection doesn't exist, just log it.
      console.error(`[startup] Could not clean stale index from ${collectionName}:`, err.message);
    }
  }
};

// ---------------------------------------------------------------------------
// Startup cleanup: drop stale unique indexes from exam collections
// (finalexams, tests).
//
// The FinalExam and Test models previously had an examCode field with a
// unique index. This field has been removed and replaced with testId/finalExamId,
// but the stale examCode_1 index remains in MongoDB. Every document without
// an examCode field effectively has examCode: null, so the stale unique index
// rejects the 2nd+ exam with E11000.
// ---------------------------------------------------------------------------
const dropStaleExamIndexes = async () => {
  const collections = ["finalexams", "tests"];
  for (const collectionName of collections) {
    try {
      const db = mongoose.connection.db;
      const col = db.collection(collectionName);
      const indexes = await col.indexes();
      const stale = indexes.filter((idx) => idx.key.examCode !== undefined);
      for (const idx of stale) {
        console.log(`[startup] Dropping stale index "${idx.name}" from ${collectionName} collection`);
        await col.dropIndex(idx.name);
        console.log(`[startup] Dropped "${idx.name}" from ${collectionName}`);
      }
    } catch (err) {
      // Non-fatal: if the collection doesn't exist, just log it.
      console.error(`[startup] Could not clean stale index from ${collectionName}:`, err.message);
    }
  }
};

mongoose.connection.once("connected", async () => {
  await dropStaleQuestionIndex();
  await dropStaleAllowedCandidateIndexes();
  await dropStaleExamIndexes();
});

const app = express();

const allowedOrigins = [
  "https://examplat-admin.nritupskills.com",
  "https://examplat-exam.nritupskills.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/tests", examRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/students", studentRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Admin Portal API running on port ${PORT}`));
