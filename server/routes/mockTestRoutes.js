const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
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
} = require("../controllers/mockTestController");
const { protect, requirePasswordChange, adminOnly } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(protect, requirePasswordChange);

router.get("/eligible-count", eligibleStudentCount);

router.post(
  "/",
  adminOnly,
  upload.fields([
    { name: "questionFile", maxCount: 1 },
    { name: "candidateFile", maxCount: 1 },
  ]),
  createMockTest
);

router.get("/", listMockTests);
router.get("/:id", getMockTest);
router.put("/:id", modifyMockTestDefaults);
router.delete("/:id", deleteMockTest);
router.post("/:id/publish-results", publishResults);

router.get("/:id/candidates", listCandidates);
router.post("/:id/candidates", addCandidate);
router.put("/:testId/candidates/:candidateId", updateCandidate);
router.get("/:testId/candidates/:candidateId", getCandidateDetail);

module.exports = router;
