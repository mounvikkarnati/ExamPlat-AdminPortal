const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
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
} = require("../controllers/examController");
const { protect, superAdminOnly, requirePasswordChange } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(protect, requirePasswordChange);

// Only Super Admins can create examinations.
router.get("/eligible-count", eligibleStudentCount);

router.post(
  "/",
  superAdminOnly,
  upload.fields([
    { name: "questionFile", maxCount: 1 },
    { name: "candidateFile", maxCount: 1 },
  ]),
  createExam
);

router.get("/", listExams);
router.get("/:id", getExam);
// Only Super Admins can decide which admins get modify access.
router.put("/:id/managers", superAdminOnly, modifyExamManagers);
// Anyone with modify access can edit schedule/attempts.
router.put("/:id", modifyExamDefaults);
// Only Super Admins can delete an examination.
router.delete("/:id", superAdminOnly, deleteExam);
// Only Super Admins can toggle result publication for an examination.
router.patch("/:id/results-published", superAdminOnly, toggleResultsPublished);
// Only Super Admins can send result release notifications.
router.post("/:id/send-result-notification", superAdminOnly, sendResultNotification);

router.get("/:id/candidates", listCandidates);
router.post("/:id/candidates", addCandidate);
router.put("/:testId/candidates/:candidateId", updateCandidate);
router.get("/:testId/candidates/:candidateId", getCandidateDetail);

module.exports = router;