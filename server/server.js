require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const testRoutes = require("./routes/testRoutes");
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

mongoose.connection.once("connected", dropStaleQuestionIndex);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // Vite selects the next available development port, so retain its two
      // standard local ports even when CLIENT_ORIGIN specifies a deployed URL.
      const allowed = [
        ...new Set([
          ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()) : []),
          "http://localhost:5173",
          "http://localhost:5174",
        ]),
      ];
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/tests", testRoutes);
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
