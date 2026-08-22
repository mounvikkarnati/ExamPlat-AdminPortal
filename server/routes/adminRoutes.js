const express = require("express");
const router = express.Router();
const { listAdmins, createAdmin, disableAdmin, listLogs } = require("../controllers/adminController");
const { protect, superAdminOnly, requirePasswordChange } = require("../middleware/auth");

router.use(protect, requirePasswordChange, superAdminOnly);

router.get("/logs", listLogs);
router.get("/", listAdmins);
router.post("/", createAdmin);
router.put("/:id/disable", disableAdmin);

module.exports = router;
