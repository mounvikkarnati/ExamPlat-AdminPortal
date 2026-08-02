const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
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
} = require("../controllers/testController");
const { protect, requirePasswordChange, superAdminOnly } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(protect, requirePasswordChange);

router.post(
  "/",
  upload.fields([
    { name: "questionFile", maxCount: 1 },
    { name: "candidateFile", maxCount: 1 },
  ]),
  createTest
);
router.get("/", listTests);
router.post("/:id/publish-results", publishResults);
router.delete("/:id", superAdminOnly, deleteTest);
router.get("/:id", getTest);
router.put("/:id", modifyTestDefaults);

router.get("/:id/candidates", listCandidates);
router.post("/:id/candidates", addCandidate);
router.put("/:testId/candidates/:candidateId", updateCandidate);
router.get("/:testId/candidates/:candidateId", getCandidateDetail);

module.exports = router;
