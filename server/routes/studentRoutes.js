const express = require("express");
const { listStudents, exportStudents } = require("../controllers/studentController");
const { protect, requirePasswordChange } = require("../middleware/auth");
const router = express.Router();
router.use(protect, requirePasswordChange);
router.get("/export", exportStudents);
router.get("/", listStudents);
module.exports = router;
